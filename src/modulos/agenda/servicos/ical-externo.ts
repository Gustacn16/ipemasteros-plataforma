import "server-only";
import { createHash } from "node:crypto";
import { ErroNegocio } from "@/lib/erros";
import { validarUrlIcal } from "@/modulos/agenda/regras/url-ical";
import { interpretarIcalIsolado } from "./ical-em-worker";
import { NAO_E_AGENDA, type EventoExterno } from "./ical-interpretar";

/**
 * Leitura das agendas pessoais por link iCal (spec, regra 6): busca, limites e cache.
 * A interpretação fica em ical-interpretar.ts e roda num worker (ical-em-worker.ts).
 * Nada daqui vai para log nem para o banco: nem a URL, nem o corpo, nem os eventos.
 */

export {
  interpretarIcal,
  MAX_OCORRENCIAS,
  type EventoExterno,
} from "./ical-interpretar";
export { interpretarIcalIsolado } from "./ical-em-worker";

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 2;
const CACHE_MS = 10 * 60 * 1000;

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

/** Quantos intervalos (de, ate) interpretados guardar por agenda. */
const MAX_INTERVALOS = 12;

/**
 * Por agenda: o texto (10 min) e, junto dele, os eventos já interpretados por intervalo.
 * Os interpretados vivem enquanto o texto vive, então valem os mesmos 10 minutos.
 */
type EntradaCache = {
  chaveUrl: string;
  expira: number;
  texto: Promise<string>;
  interpretados: Map<string, Promise<EventoExterno[]>>;
};
const cache = new Map<string, EntradaCache>();

function chaveDaUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/** Remove a agenda do cache, texto e interpretados (ao editar, trocar ou remover). */
export function esquecerAgendaExterna(id: string): void {
  cache.delete(id);
}

/** Lê a agenda `id`, guardando texto e eventos interpretados por 10 minutos. Falhas não ficam no cache. */
export async function lerAgendaExterna(id: string, url: string, de: string, ate: string): Promise<EventoExterno[]> {
  const agora = Date.now();
  for (const [chave, entrada] of cache) if (entrada.expira <= agora) cache.delete(chave);

  const chaveUrl = chaveDaUrl(url);
  let entrada = cache.get(id);
  if (!entrada || entrada.chaveUrl !== chaveUrl) {
    const nova: EntradaCache = {
      chaveUrl,
      expira: Number.POSITIVE_INFINITY,
      texto: buscarIcal(url),
      interpretados: new Map(),
    };
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
  const texto = await entrada.texto;

  const chaveIntervalo = `${de}|${ate}`;
  let eventos = entrada.interpretados.get(chaveIntervalo);
  if (!eventos) {
    if (entrada.interpretados.size >= MAX_INTERVALOS) {
      const maisAntigo = entrada.interpretados.keys().next().value;
      if (maisAntigo !== undefined) entrada.interpretados.delete(maisAntigo);
    }
    const novos = interpretarIcalIsolado(texto, de, ate);
    const dona = entrada;
    dona.interpretados.set(chaveIntervalo, novos);
    novos.catch(() => {
      if (dona.interpretados.get(chaveIntervalo) === novos) dona.interpretados.delete(chaveIntervalo);
    });
    eventos = novos;
  }
  return eventos;
}
