// Interpretação pura do texto iCal das agendas pessoais (spec, regra 6).
// Sem "server-only" de propósito: este módulo roda dentro do worker (ical-worker.ts).
// Nada daqui vai para log: nem o texto, nem os eventos.
import ICAL from "ical.js";
import { ErroNegocio } from "@/lib/erros";

export type EventoExterno = {
  uid: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
  local: string | null;
};

export const MAX_OCORRENCIAS = 2000;
/** Passos do iterador por série. Estourou: a série é pulada sozinha. */
export const MAX_PASSOS_POR_SERIE = 50_000;
const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

export const NAO_E_AGENDA = "Este endereço não é de uma agenda.";
export const NAO_INTERPRETOU = "Não consegui interpretar esta agenda.";

/** Meia-noite de São Paulo (UTC−3 fixo) do dia "AAAA-MM-DD". */
function meiaNoiteSp(dia: string): number {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(dia) ? Date.parse(`${dia}T00:00:00Z`) : Number.NaN;
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

// Maior dia de cada mês, contando o 29/02 dos anos bissextos.
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Verdadeiro quando a combinação BYMONTH/BYMONTHDAY/BYYEARDAY nunca acontece
 * (ex.: 30/02, 31/04, dia 0), ou quando há BYWEEKNO fora de FREQ=YEARLY (proibido
 * pela RFC 5545). O ical.js 2.1 entra em laço infinito com algumas delas. Não é uma
 * lista completa: a garantia de verdade é o timeout do worker (ical-em-worker.ts).
 */
export function regraImpossivel(partes: Record<string, unknown>, frequencia?: string): boolean {
  if (partes.BYWEEKNO !== undefined && frequencia !== undefined && frequencia.toUpperCase() !== "YEARLY") return true;

  const numeros = (chave: string): number[] | null => {
    const v = partes[chave];
    if (v === undefined) return null;
    return (Array.isArray(v) ? v : [v]).map(Number);
  };

  const meses = numeros("BYMONTH");
  const mesesValidos = meses ? meses.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12) : null;
  if (mesesValidos && mesesValidos.length === 0) return true;
  const maiorDia = Math.max(...(mesesValidos ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map((m) => DIAS_NO_MES[m - 1]));

  const diasDoMes = numeros("BYMONTHDAY");
  if (diasDoMes && !diasDoMes.some((d) => Number.isInteger(d) && d !== 0 && Math.abs(d) <= maiorDia)) return true;

  const diasDoAno = numeros("BYYEARDAY");
  if (diasDoAno && !diasDoAno.some((d) => Number.isInteger(d) && d !== 0 && Math.abs(d) <= 366)) return true;

  return false;
}

function serieImpossivel(ev: ICAL.Event): boolean {
  return ev.component.getAllProperties("rrule").some((p) => {
    const regra = p.getFirstValue() as unknown as { parts?: Record<string, unknown>; freq?: string } | null;
    return regraImpossivel(regra?.parts ?? {}, regra?.freq);
  });
}

/**
 * Eventos do texto iCal que tocam o intervalo [de, ate] (dias "AAAA-MM-DD", inclusivos,
 * em São Paulo), com RRULE/EXDATE/RECURRENCE-ID expandidos. No máximo 2.000 ocorrências.
 * Dia inteiro: `inicio` é meia-noite de São Paulo e `fim` é exclusivo (como `instanteFim`).
 *
 * Use `interpretarIcalIsolado` (worker com timeout) no servidor: esta função é síncrona.
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

  const emitir = (ev: ICAL.Event, inicioT: ICAL.Time, fimT: ICAL.Time, destino: EventoExterno[]): void => {
    if (cancelado(ev)) return;
    const inicio = paraData(inicioT);
    let fim = paraData(fimT);
    if (fim < inicio) fim = inicio;
    const toca =
      inicio.getTime() < fimIntervalo && (fim.getTime() > inicioIntervalo || inicio.getTime() >= inicioIntervalo);
    if (!toca) return;
    destino.push({
      uid: ev.uid || "",
      titulo: textoOuNulo(ev.summary) ?? "(sem título)",
      inicio,
      fim,
      diaInteiro: inicioT.isDate,
      local: textoOuNulo(ev.location),
    });
  };

  for (const ev of principais) {
    if (saida.length >= MAX_OCORRENCIAS) break;
    try {
      if (!ev.startDate) continue;
      // Regra impossível: fica só a ocorrência do próprio DTSTART, sem expandir.
      if (!ev.isRecurring() || serieImpossivel(ev)) {
        emitir(ev, ev.startDate, ev.endDate, saida);
        continue;
      }
      // Cada série tem o próprio orçamento; só entra na saída se terminar dentro dele.
      const daSerie: EventoExterno[] = [];
      const vagas = MAX_OCORRENCIAS - saida.length;
      let estourou = true;
      const iterador = ev.iterator();
      for (let passos = 0; passos < MAX_PASSOS_POR_SERIE; passos++) {
        const ocorrencia = iterador.next();
        if (!ocorrencia || paraData(ocorrencia).getTime() >= fimIntervalo || daSerie.length >= vagas) {
          estourou = false;
          break;
        }
        const detalhe = ev.getOccurrenceDetails(ocorrencia);
        emitir(detalhe.item, detalhe.startDate, detalhe.endDate, daSerie);
      }
      if (!estourou) saida.push(...daSerie.slice(0, vagas));
    } catch {
      // RRULE ou data malformada: ignora só esta série
    }
  }

  return saida.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.uid.localeCompare(b.uid));
}

// ---------------------------------------------------------------------------
// Protocolo do worker

export type PedidoInterpretacao = { texto: string; de: string; ate: string };
export type RespostaInterpretacao = { ok: true; eventos: EventoExterno[] } | { ok: false; mensagem: string };

/** Corpo do worker: nunca lança, e só devolve mensagens seguras para a tela. */
export function processarPedido(pedido: unknown): RespostaInterpretacao {
  try {
    const p = pedido as Partial<PedidoInterpretacao> | null;
    if (!p || typeof p.texto !== "string" || typeof p.de !== "string" || typeof p.ate !== "string") {
      return { ok: false, mensagem: NAO_INTERPRETOU };
    }
    return { ok: true, eventos: interpretarIcal(p.texto, p.de, p.ate) };
  } catch (e) {
    return { ok: false, mensagem: e instanceof ErroNegocio ? e.message : NAO_INTERPRETOU };
  }
}
