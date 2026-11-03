import { timingSafeEqual } from "node:crypto";

/**
 * Confere o header `Authorization: Bearer <CRON_SECRET>` dos jobs agendados.
 * Sem segredo configurado, recusa tudo (nunca "aceita qualquer um").
 */
export function segredoValido(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho) return false;
  const recebido = Buffer.from(cabecalho);
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
