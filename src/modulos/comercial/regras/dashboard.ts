// Contas do dashboard comercial (spec Comercial, seção 8). Dinheiro em centavos.
import { mesAnterior } from "./meta";

const centavos = (v: string) => Math.round(Number(v) * 100);

/** Variação % (inteira) do vendido contra o mês anterior; `null` sem venda no mês anterior. */
export function variacao(atual: string, anterior: string): number | null {
  const base = centavos(anterior);
  if (base === 0) return null;
  return Math.round(((centavos(atual) - base) / base) * 100);
}

/** Vendido ÷ quantidade; `null` sem vendas. */
export function ticketMedio(vendido: string, quantidade: number): string | null {
  if (quantidade === 0) return null;
  return (Math.round(centavos(vendido) / quantidade) / 100).toFixed(2);
}

/** % inteiro do realizado sobre o alvo (centavos ou quantidade); `null` sem meta. */
export function percentualMeta(realizado: number, alvo: number): number | null {
  return alvo === 0 ? null : Math.round((realizado / alvo) * 100);
}

export type FaixaMeta = "verde" | "amarelo" | "vermelho";

/** Verde ≥ 100%, amarelo 70–99%, vermelho < 70%. */
export function faixaMeta(percentual: number | null): FaixaMeta | null {
  if (percentual === null) return null;
  if (percentual >= 100) return "verde";
  if (percentual >= 70) return "amarelo";
  return "vermelho";
}

/** Os `quantidade` meses que terminam em `ultimo`, do mais antigo ao mais recente. */
export function mesesDaJanela(ultimo: string, quantidade: number): string[] {
  const meses = [ultimo];
  while (meses.length < quantidade) meses.unshift(mesAnterior(meses[0]!));
  return meses;
}

/** Total vendido na série e quantos meses com meta bateram a meta. */
export function resumoSerie(serie: { mes: string; vendido: string; meta: string }[]): { total: string; comMeta: number; bateram: number } {
  const comMeta = serie.filter((m) => centavos(m.meta) > 0);
  return {
    total: (serie.reduce((s, m) => s + centavos(m.vendido), 0) / 100).toFixed(2),
    comMeta: comMeta.length,
    bateram: comMeta.filter((m) => centavos(m.vendido) >= centavos(m.meta)).length,
  };
}
