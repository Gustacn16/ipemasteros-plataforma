// Regras da página de início: janela de próximos dias e agrupamento por dia.
import { somarDias } from "@/modulos/tarefas/regras/prazo";

/** Quantos dias à frente o início mostra (hoje incluso). */
export const DIAS_INICIO = 7;

const formatoDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Hoje", "Amanhã" ou "qua., 5 de nov." para um "AAAA-MM-DD". */
export function rotuloDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  if (dia === somarDias(hoje, 1)) return "Amanhã";
  return formatoDia.format(new Date(`${dia}T00:00:00Z`));
}

/**
 * Agrupa eventos pelo dia em que aparecem a partir de hoje. Evento de vários
 * dias que já começou aparece em "Hoje", uma vez só.
 */
export function agruparPorDia<T extends { dataInicio: string }>(itens: T[], hoje: string): { dia: string; itens: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const dia = item.dataInicio < hoje ? hoje : item.dataInicio;
    grupos.set(dia, [...(grupos.get(dia) ?? []), item]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, itens]) => ({ dia, itens }));
}
