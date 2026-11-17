import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cliente: Anthropic | null = null;

/** Cliente único por processo. Devolve null quando ANTHROPIC_API_KEY não está configurada. */
export function obterClienteAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  cliente ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  return cliente;
}

export function iaConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
