// Regras puras da faixa de números da Agenda. Dias "AAAA-MM-DD".
import { somarDias } from "@/modulos/tarefas/regras/prazo";

type ComPeriodo = { inicio: string; fim: string };

/** Dias da faixa "Próximos 7 dias": hoje e os 6 seguintes. */
export const DIAS_RESUMO = 7;

/** Quantos itens tocam o intervalo [de, ate] (um evento de vários dias conta uma vez). */
export function contarNoIntervalo(itens: ComPeriodo[], de: string, ate: string): number {
  return itens.filter((i) => i.inicio <= ate && i.fim >= de).length;
}

/** Último dia da faixa "Próximos 7 dias". */
export function fimDoResumo(hoje: string): string {
  return somarDias(hoje, DIAS_RESUMO - 1);
}

/** O intervalo carregado [de, ate] já cobre de hoje até hoje+6? */
export function cobreResumo(intervalo: { de: string; ate: string }, hoje: string): boolean {
  return intervalo.de <= hoje && intervalo.ate >= fimDoResumo(hoje);
}
