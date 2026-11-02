import "server-only";
import { createHash } from "node:crypto";
import ICAL from "ical.js";
import { ErroNegocio } from "@/lib/erros";
import { validarUrlIcal } from "@/modulos/agenda/regras/url-ical";

/**
 * Leitura das agendas pessoais por link iCal (spec, regra 6).
 * Nada daqui vai para log nem para o banco: nem a URL, nem o corpo, nem os eventos.
 */

export type EventoExterno = {
  uid: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
  local: string | null;
};

export const MAX_OCORRENCIAS = 2000;
/** Passos do iterador de recorrência por agenda (protege contra RRULE antigas e densas). */
const MAX_PASSOS = 100_000;
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 2;
const CACHE_MS = 10 * 60 * 1000;
const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

const NAO_E_AGENDA = "Este endereço não é de uma agenda.";

// ---------------------------------------------------------------------------
// Interpretação (pura)

/** Meia-noite de São Paulo (UTC−3 fixo) do dia "AAAA-MM-DD". */
function meiaNoiteSp(dia: string): number {
  const ms = Date.parse(`${dia}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error("Dia inválido.");
  return ms + 3 * HORA_MS;
}

/** Instante UTC de um ICAL.Time. Datas e horas sem fuso são lidas como São Paulo. */
function paraData(t: ICAL.Time): Date {
  if (t.isDate) return new Date(Date.UTC(t.year, t.month - 1, t.day) + 3 * HORA_MS);
  if (!t.zone || t.zone === ICAL.Timezone.localTimezone) {
    return new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) + 3 * HORA_MS);
  }
  return new Date(t.toUnixTime() * 1000);
}

function cancelado(ev: ICAL.Event): boolean {
  return String(ev.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";
}

function textoOuNulo(valor: unknown): string | null {
  const s = typeof valor === "string" ? valor.trim() : "";
  return s === "" ? null : s;
}

/**
 * Eventos do texto iCal que tocam o intervalo [de, ate] (dias "AAAA-MM-DD", inclusivos,
 * em São Paulo), com RRULE/EXDATE/RECURRENCE-ID expandidos. No máximo 2.000 ocorrências.
 * Dia inteiro: `inicio` é meia-noite de São Paulo e `fim` é exclusivo (como `instanteFim`).
 */
export function interpretarIcal(texto: string, de: string, ate: string): EventoExterno[] {
  const inicioIntervalo = meiaNoiteSp(de);
  const fimIntervalo = meiaNoiteSp(ate) + DIA_MS;

  let raiz: ICAL.Component;
  try {
    raiz = new ICAL.Component(ICAL.parse(texto));
  } catch {
    throw new ErroNegocio(NAO_E_AGENDA);
  }
  if (raiz.name !== "vcalendar") throw new ErroNegocio(NAO_E_AGENDA);

  // Séries e ocorrências avulsas; exceções (RECURRENCE-ID) ligadas à série do mesmo UID.
  const principais: ICAL.Event[] = [];
  const porUid = new Map<string, ICAL.Event>();
  const excecoes: ICAL.Component[] = [];
  for (const comp of raiz.getAllSubcomponents("vevent")) {
    try {
      if (comp.hasProperty("recurrence-id")) {
        excecoes.push(comp);
        continue;
      }
      const ev = new ICAL.Event(comp);
      principais.push(ev);
      if (ev.uid && !porUid.has(ev.uid)) porUid.set(ev.uid, ev);
    } catch {
      // evento malformado: ignora só ele
    }
  }
  for (const comp of excecoes) {
    try {
      const uid = String(comp.getFirstPropertyValue("uid") ?? "");
      const serie = porUid.get(uid);
      if (serie && serie.isRecurring()) serie.relateException(comp);
      else principais.push(new ICAL.Event(comp));
    } catch {
      // idem
    }
  }

  const saida: EventoExterno[] = [];
  let passos = 0;

  const emitir = (ev: ICAL.Event, inicioT: ICAL.Time, fimT: ICAL.Time): void => {
    if (cancelado(ev)) return;
    const inicio = paraData(inicioT);
    let fim = paraData(fimT);
    if (fim < inicio) fim = inicio;
    const toca = inicio.getTime() < fimIntervalo && (fim.getTime() > inicioIntervalo || inicio.getTime() >= inicioIntervalo);
    if (!toca) return;
    saida.push({
      uid: ev.uid || "",
      titulo: textoOuNulo(ev.summary) ?? "(sem título)",
      inicio,
      fim,
      diaInteiro: inicioT.isDate,
      local: textoOuNulo(ev.location),
    });
  };

  externo: for (const ev of principais) {
    try {
      if (!ev.startDate) continue;
      if (!ev.isRecurring()) {
        emitir(ev, ev.startDate, ev.endDate);
        if (saida.length >= MAX_OCORRENCIAS) break;
        continue;
      }
      const iterador = ev.iterator();
      for (let ocorrencia = iterador.next(); ocorrencia; ocorrencia = iterador.next()) {
        if (++passos > MAX_PASSOS) break externo;
        if (paraData(ocorrencia).getTime() >= fimIntervalo) break;
        const detalhe = ev.getOccurrenceDetails(ocorrencia);
        emitir(detalhe.item, detalhe.startDate, detalhe.endDate);
        if (saida.length >= MAX_OCORRENCIAS) break externo;
      }
    } catch {
      // RRULE ou data malformada: ignora só esta série
    }
  }

  return saida.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.uid.localeCompare(b.uid));
}

// ---------------------------------------------------------------------------
// Busca na rede

function ehTimeout(e: unknown): boolean {
  return typeof e === "object" && e !== null && "name" in e && (e.name === "TimeoutError" || e.name === "AbortError");
}

async function lerCorpoLimitado(resposta: Response): Promise<string> {
  const tamanho = Number(resposta.headers.get("content-length"));
  if (Number.isFinite(tamanho) && tamanho > MAX_BYTES) {
    await resposta.body?.cancel().catch(() => {});
    throw new ErroNegocio("A agenda é grande demais (mais de 5 MB).");
  }
  if (!resposta.body) return "";
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder("utf-8");
  let total = 0;
  let texto = "";
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await leitor.cancel().catch(() => {});
      throw new ErroNegocio("A agenda é grande demais (mais de 5 MB).");
    }
    texto += decodificador.decode(value, { stream: true });
  }
  return texto + decodificador.decode();
}

/**
 * Busca o texto iCal. Só segue redirecionamentos (no máximo 2) para endereços que
 * passam em `validarUrlIcal`. Timeout de 8 s para tudo, corpo de no máximo 5 MB.
 */
export async function buscarIcal(url: string): Promise<string> {
  const validada = validarUrlIcal(url);
  if (!validada.ok) throw new ErroNegocio(validada.mensagem);

  const sinal = AbortSignal.timeout(TIMEOUT_MS);
  let atual = validada.url;
  try {
    for (let saltos = 0; ; saltos++) {
      const resposta = await fetch(atual, {
        redirect: "manual",
        signal: sinal,
        cache: "no-store",
        headers: { accept: "text/calendar, */*;q=0.1" },
      });

      if (resposta.status >= 300 && resposta.status < 400) {
        await resposta.body?.cancel().catch(() => {});
        const destino = resposta.headers.get("location");
        if (!destino) throw new ErroNegocio(`O endereço respondeu com erro ${resposta.status}.`);
        if (saltos >= MAX_REDIRECTS) throw new ErroNegocio("O endereço redirecionou vezes demais.");
        let proxima: URL;
        try {
          proxima = new URL(destino, atual);
        } catch {
          throw new ErroNegocio("O endereço redirecionou para um lugar não permitido.");
        }
        const ok = validarUrlIcal(proxima.href);
        if (!ok.ok) throw new ErroNegocio("O endereço redirecionou para um lugar não permitido.");
        atual = ok.url;
        continue;
      }

      if (!resposta.ok) {
        await resposta.body?.cancel().catch(() => {});
        throw new ErroNegocio(`O endereço respondeu com erro ${resposta.status}.`);
      }

      const texto = await lerCorpoLimitado(resposta);
      if (!texto.includes("BEGIN:VCALENDAR")) throw new ErroNegocio(NAO_E_AGENDA);
      return texto;
    }
  } catch (e) {
    if (e instanceof ErroNegocio) throw e;
    if (ehTimeout(e)) throw new ErroNegocio("O endereço demorou demais para responder.");
    throw new ErroNegocio("Não consegui acessar o endereço.");
  }
}

// ---------------------------------------------------------------------------
// Cache em memória (uma instância do app; ver spec, riscos)

type EntradaCache = { chaveUrl: string; expira: number; texto: Promise<string> };
const cache = new Map<string, EntradaCache>();

function chaveDaUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/** Remove a agenda do cache (ao trocar ou remover o link). */
export function esquecerAgendaExterna(id: string): void {
  cache.delete(id);
}

/** Lê a agenda `id`, guardando o texto por 10 minutos. Falhas não ficam no cache. */
export async function lerAgendaExterna(id: string, url: string, de: string, ate: string): Promise<EventoExterno[]> {
  const agora = Date.now();
  for (const [chave, entrada] of cache) if (entrada.expira <= agora) cache.delete(chave);

  const chaveUrl = chaveDaUrl(url);
  let entrada = cache.get(id);
  if (!entrada || entrada.chaveUrl !== chaveUrl) {
    const nova: EntradaCache = { chaveUrl, expira: Number.POSITIVE_INFINITY, texto: buscarIcal(url) };
    cache.set(id, nova);
    nova.texto.then(
      () => {
        nova.expira = Date.now() + CACHE_MS;
      },
      () => {
        if (cache.get(id) === nova) cache.delete(id);
      },
    );
    entrada = nova;
  }
  return interpretarIcal(await entrada.texto, de, ate);
}
