// Cálculo da comissão do mês (aba Comissões). Regra combinada com o Gustavo em 2026-11-17:
// quem bate a meta (em quantidade) de um produto no mês ganha o "bônus meta" em todas as vendas
// desse produto naquele mês; senão, vale a "base". Sem meta no produto, vale a base.
import type { TipoComissao } from "../esquemas/produto";

export type RegraComissao = { nome: string; tipo: TipoComissao; base: string; bonus: string };

const centavos = (v: string) => Math.round(Number(v) * 100);
const reais = (c: number) => (c / 100).toFixed(2);

/** Comissão de uma venda: R$ fixo, ou % sobre o valor total do contrato (VTC). */
export function comissaoDaVenda(tipo: TipoComissao, taxa: string, valorTotal: string): string {
  return tipo === "valor" ? reais(centavos(taxa)) : reais(Math.round((centavos(valorTotal) * Number(taxa)) / 100));
}

export type LinhaProduto = {
  produtoId: string;
  nome: string;
  tipo: TipoComissao | null;
  vendas: number;
  meta: number;
  bateuMeta: boolean;
  /** Valor ou percentual usado (base ou bônus). */
  taxa: string;
  vendido: string;
  comissao: string;
};
export type ComissaoVendedor = {
  id: string;
  nome: string;
  vendas: number;
  totalVendido: string;
  comissao: string;
  produtos: LinhaProduto[];
};

export function calcularComissoes(o: {
  vendedores: { id: string; nome: string }[];
  vendas: { vendedorId: string; produtoId: string; valorTotal: string }[];
  metas: { vendedorId: string; produtoId: string; quantidadeAlvo: number }[];
  produtos: Map<string, RegraComissao>;
}): { totalVendido: string; totalComissao: string; vendedores: ComissaoVendedor[] } {
  const chave = (vendedorId: string, produtoId: string) => `${vendedorId}|${produtoId}`;
  const grupos = new Map<string, { vendedorId: string; produtoId: string; valores: string[] }>();
  for (const v of o.vendas) {
    const k = chave(v.vendedorId, v.produtoId);
    const g = grupos.get(k) ?? { vendedorId: v.vendedorId, produtoId: v.produtoId, valores: [] };
    g.valores.push(v.valorTotal);
    grupos.set(k, g);
  }
  const metas = new Map(o.metas.map((m) => [chave(m.vendedorId, m.produtoId), m.quantidadeAlvo]));

  const linhas = [...grupos.values()].map((g): { vendedorId: string; linha: LinhaProduto } => {
    const regra = o.produtos.get(g.produtoId);
    const meta = metas.get(chave(g.vendedorId, g.produtoId)) ?? 0;
    const bateuMeta = meta > 0 && g.valores.length >= meta;
    // Bônus zerado ou vazio: fica a base.
    const taxa = regra ? (bateuMeta && Number(regra.bonus) > 0 ? regra.bonus : regra.base) : "0.00";
    const comissao = regra ? g.valores.reduce((s, v) => s + centavos(comissaoDaVenda(regra.tipo, taxa, v)), 0) : 0;
    return {
      vendedorId: g.vendedorId,
      linha: {
        produtoId: g.produtoId,
        nome: regra?.nome ?? "Produto",
        tipo: regra?.tipo ?? null,
        vendas: g.valores.length,
        meta,
        bateuMeta,
        taxa,
        vendido: reais(g.valores.reduce((s, v) => s + centavos(v), 0)),
        comissao: reais(comissao),
      },
    };
  });

  // Quem vendeu sem estar na lista (ex.: saiu da equipe) também aparece.
  const pessoas = [...o.vendedores];
  for (const l of linhas) if (!pessoas.some((p) => p.id === l.vendedorId)) pessoas.push({ id: l.vendedorId, nome: "Vendedor" });

  const vendedores = pessoas
    .map((p): ComissaoVendedor => {
      const minhas = linhas.filter((l) => l.vendedorId === p.id).map((l) => l.linha);
      return {
        id: p.id,
        nome: p.nome,
        vendas: minhas.reduce((s, l) => s + l.vendas, 0),
        totalVendido: reais(minhas.reduce((s, l) => s + centavos(l.vendido), 0)),
        comissao: reais(minhas.reduce((s, l) => s + centavos(l.comissao), 0)),
        produtos: minhas.sort((a, b) => centavos(b.comissao) - centavos(a.comissao)),
      };
    })
    .sort(
      (a, b) =>
        centavos(b.comissao) - centavos(a.comissao) ||
        centavos(b.totalVendido) - centavos(a.totalVendido) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );

  return {
    totalVendido: reais(vendedores.reduce((s, v) => s + centavos(v.totalVendido), 0)),
    totalComissao: reais(vendedores.reduce((s, v) => s + centavos(v.comissao), 0)),
    vendedores,
  };
}
