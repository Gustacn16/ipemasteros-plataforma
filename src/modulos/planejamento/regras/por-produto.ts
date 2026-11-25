import { desempenho, statusDe, type Status } from "./desempenho";
import type { MetaProdutoMes, MetasPorProduto } from "./turmas";

export type LinhaPorProduto = { produtoId: string; meta: MetaProdutoMes; realizado: MetaProdutoMes; pct: number | null; status: Status | null };

const zero = (): MetaProdutoMes => ({ alunos: 0, valorCentavos: 0 });

/** Meta × realizado de cada produto (com meta ou com venda). Status pelo valor vendido. */
export function metaVsRealizadoPorProduto(metas: MetasPorProduto, realizados: MetasPorProduto): LinhaPorProduto[] {
  const ids = [...new Set([...Object.keys(metas), ...Object.keys(realizados)])];
  return ids
    .map((produtoId) => {
      const meta = metas[produtoId] ?? zero();
      const realizado = realizados[produtoId] ?? zero();
      const pct = desempenho(realizado.valorCentavos, meta.valorCentavos || null, "maior_melhor");
      return { produtoId, meta, realizado, pct, status: statusDe(pct) };
    })
    .filter((l) => l.meta.alunos || l.meta.valorCentavos || l.realizado.alunos || l.realizado.valorCentavos)
    .sort((a, b) => b.meta.valorCentavos - a.meta.valorCentavos || b.realizado.valorCentavos - a.realizado.valorCentavos);
}

/** Soma por produto de vários meses. */
export function somarPorProduto(lista: MetasPorProduto[]): MetasPorProduto {
  const r: MetasPorProduto = {};
  for (const m of lista) {
    for (const [id, v] of Object.entries(m)) {
      const a = r[id] ?? zero();
      r[id] = { alunos: a.alunos + v.alunos, valorCentavos: a.valorCentavos + v.valorCentavos };
    }
  }
  return r;
}
