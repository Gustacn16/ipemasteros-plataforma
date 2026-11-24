import { config } from "./config.ts";
import { ErroHttp } from "./erro-http.ts";
import type { ComandoMotor, EventoMotor, ResultadoComando } from "./tipos.ts";

const TEMPO_LIMITE_MS = 15_000;
/** Um lote de eventos pode levar até ~500 itens para o sistema gravar: espera mais antes de desistir. */
const TEMPO_LIMITE_EVENTOS_MS = 60_000;

/** Chamada HTTPS ao sistema com o segredo do motor. Erros citam só rota e status, nunca o segredo. */
async function chamar(
  caminho: string,
  init: { method: "GET" | "POST"; corpo?: unknown; tempoLimiteMs?: number },
) {
  const resposta = await fetch(`${config.sistemaUrl}${caminho}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${config.segredo}`,
      ...(init.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.corpo !== undefined ? JSON.stringify(init.corpo) : undefined,
    signal: AbortSignal.timeout(init.tempoLimiteMs ?? TEMPO_LIMITE_MS),
  });
  if (!resposta.ok) throw new ErroHttp(`${init.method} ${caminho} respondeu ${resposta.status}`, resposta.status);
  return resposta;
}

export async function enviarEventos(eventos: EventoMotor[]): Promise<void> {
  await chamar("/api/whatsapp/motor/eventos", {
    method: "POST",
    corpo: { eventos },
    tempoLimiteMs: TEMPO_LIMITE_EVENTOS_MS,
  });
}

export async function buscarComandos(): Promise<ComandoMotor[]> {
  const resposta = await chamar("/api/whatsapp/motor/comandos?recursos=enviar_grupo", { method: "GET" });
  const dados = (await resposta.json()) as { comandos?: ComandoMotor[] };
  return dados.comandos ?? [];
}

export async function responderComando(id: string, resultado: ResultadoComando): Promise<void> {
  await chamar(`/api/whatsapp/motor/comandos/${encodeURIComponent(id)}`, {
    method: "POST",
    corpo: resultado,
  });
}
