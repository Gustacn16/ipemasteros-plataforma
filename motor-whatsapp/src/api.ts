import { config } from "./config.ts";
import type { ComandoMotor, EventoMotor, ResultadoComando } from "./tipos.ts";

const TEMPO_LIMITE_MS = 15_000;

/** Chamada HTTPS ao sistema com o segredo do motor. Erros citam só rota e status, nunca o segredo. */
async function chamar(caminho: string, init: { method: "GET" | "POST"; corpo?: unknown }) {
  const resposta = await fetch(`${config.sistemaUrl}${caminho}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${config.segredo}`,
      ...(init.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.corpo !== undefined ? JSON.stringify(init.corpo) : undefined,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!resposta.ok) throw new Error(`${init.method} ${caminho} respondeu ${resposta.status}`);
  return resposta;
}

export async function enviarEventos(eventos: EventoMotor[]): Promise<void> {
  await chamar("/api/whatsapp/motor/eventos", { method: "POST", corpo: { eventos } });
}

export async function buscarComandos(): Promise<ComandoMotor[]> {
  const resposta = await chamar("/api/whatsapp/motor/comandos", { method: "GET" });
  const dados = (await resposta.json()) as { comandos?: ComandoMotor[] };
  return dados.comandos ?? [];
}

export async function responderComando(id: string, resultado: ResultadoComando): Promise<void> {
  await chamar(`/api/whatsapp/motor/comandos/${encodeURIComponent(id)}`, {
    method: "POST",
    corpo: resultado,
  });
}
