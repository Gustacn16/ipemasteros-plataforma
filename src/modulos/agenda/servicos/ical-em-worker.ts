import "server-only";
import { Worker } from "worker_threads";
import { ErroNegocio } from "@/lib/erros";
import { NAO_INTERPRETOU, type EventoExterno, type RespostaInterpretacao } from "./ical-interpretar";

/**
 * Interpreta o iCal num worker_thread com prazo. O ical.js pode entrar em laço
 * síncrono infinito com algumas RRULE; aqui o laço fica preso no worker, que é
 * encerrado com `terminate()`, e o processo do servidor segue respondendo.
 */

export const TIMEOUT_INTERPRETACAO_MS = 3000;

type Opcoes = { timeoutMs?: number; criarWorker?: () => Worker };

function criarWorkerPadrao(): Worker {
  // Mantenha esta forma literal: é ela que o webpack reconhece para gerar o chunk do worker.
  return new Worker(new URL("./ical-worker.ts", import.meta.url), {
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
}

function respostaValida(r: unknown): r is RespostaInterpretacao {
  if (typeof r !== "object" || r === null || !("ok" in r)) return false;
  if (r.ok === true) return "eventos" in r && Array.isArray(r.eventos);
  return r.ok === false && "mensagem" in r && typeof r.mensagem === "string";
}

// ---------------------------------------------------------------------------
// Limite global de interpretações simultâneas (cada uma é um worker com até 256 MB).

export const MAX_INTERPRETACOES_SIMULTANEAS = 4;

let emUso = 0;
const fila: (() => void)[] = [];

function ocuparVaga(): Promise<void> {
  if (emUso < MAX_INTERPRETACOES_SIMULTANEAS) {
    emUso++;
    return Promise.resolve();
  }
  return new Promise<void>((r) => fila.push(r));
}

/** Passa a vaga direto para o próximo da fila, ou a devolve. */
function liberarVaga(): void {
  const proximo = fila.shift();
  if (proximo) proximo();
  else emUso--;
}

/**
 * Interpreta `texto` num worker, com no máximo 4 ao mesmo tempo no processo.
 * O prazo de 3 s conta a partir do início no worker, não da espera na fila.
 */
export async function interpretarIcalIsolado(
  texto: string,
  de: string,
  ate: string,
  opcoes: Opcoes = {},
): Promise<EventoExterno[]> {
  await ocuparVaga();
  return interpretarNoWorker(texto, de, ate, opcoes);
}

function interpretarNoWorker(texto: string, de: string, ate: string, opcoes: Opcoes): Promise<EventoExterno[]> {
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_INTERPRETACAO_MS;
  return new Promise<EventoExterno[]>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = (opcoes.criarWorker ?? criarWorkerPadrao)();
    } catch {
      liberarVaga();
      reject(new ErroNegocio(NAO_INTERPRETOU));
      return;
    }
    let terminado = false;
    const encerrar = (acao: () => void) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(prazo);
      worker.on("error", () => {}); // erros tardios do worker encerrado não derrubam o processo
      // A vaga só volta quando o worker terminou de fato.
      void worker.terminate().catch(() => {}).finally(liberarVaga);
      acao();
    };
    const falhar = () => encerrar(() => reject(new ErroNegocio(NAO_INTERPRETOU)));
    const prazo = setTimeout(falhar, timeoutMs);

    worker.once("message", (r: unknown) => {
      if (!respostaValida(r)) return falhar();
      encerrar(() => (r.ok ? resolve(r.eventos) : reject(new ErroNegocio(r.mensagem))));
    });
    worker.once("error", falhar);
    worker.once("exit", falhar);
    worker.postMessage({ texto, de, ate });
  });
}
