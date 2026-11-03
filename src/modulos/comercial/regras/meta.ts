// Regras das metas mensais por produto e vendedor (spec Comercial, seções 4 e 5).
// Mês como "AAAA-MM"; no banco, a data do dia 1.
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export type MetaChave = { produtoId: string; vendedorId: string; valorAlvo: string; quantidadeAlvo: number };
export type Total = { valor: string; quantidade: number };

/** Mês atual ("AAAA-MM") no calendário de São Paulo. */
export function mesAtual(agora: Date): string {
  return diaEmSaoPaulo(agora).slice(0, 7);
}

function deslocarMes(mes: string, meses: number): string {
  const data = new Date(`${mes}-01T00:00:00Z`);
  data.setUTCMonth(data.getUTCMonth() + meses);
  return data.toISOString().slice(0, 7);
}

export const mesAnterior = (mes: string) => deslocarMes(mes, -1);
export const mesSeguinte = (mes: string) => deslocarMes(mes, 1);
export const primeiroDiaDoMes = (mes: string) => `${mes}-01`;

const formatoMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

/** "2026-11" → "novembro de 2026". */
export function rotuloMes(mes: string): string {
  return formatoMes.format(new Date(`${mes}-01T00:00:00Z`));
}

/** Linha sem valor e sem quantidade: ao salvar, apaga a meta em vez de gravar zero. */
export function metaVazia(l: { valorAlvo: string; quantidadeAlvo: number }): boolean {
  return Number(l.valorAlvo) === 0 && l.quantidadeAlvo === 0;
}

/**
 * "Copiar do mês anterior" (regra 9): as metas do mês anterior que ainda não
 * existem no mês, só de produtos e vendedores ativos. Nunca sobrescreve.
 */
export function metasParaCopiar(
  anteriores: MetaChave[],
  existentes: { produtoId: string; vendedorId: string }[],
  ativos: { produtos: string[]; vendedores: string[] },
): MetaChave[] {
  const chave = (m: { produtoId: string; vendedorId: string }) => `${m.produtoId}|${m.vendedorId}`;
  const jaExistem = new Set(existentes.map(chave));
  const produtos = new Set(ativos.produtos);
  const vendedores = new Set(ativos.vendedores);
  return anteriores.filter((m) => !jaExistem.has(chave(m)) && produtos.has(m.produtoId) && vendedores.has(m.vendedorId));
}

const centavos = (v: string) => Math.round(Number(v) * 100);

/** Totais das metas por produto, por vendedor e no geral, somados em centavos. */
export function totaisMetas(metas: MetaChave[]): { porProduto: Record<string, Total>; porVendedor: Record<string, Total>; geral: Total } {
  const somar = (grupos: Map<string, { c: number; q: number }>, id: string, m: MetaChave) => {
    const g = grupos.get(id) ?? { c: 0, q: 0 };
    grupos.set(id, { c: g.c + centavos(m.valorAlvo), q: g.q + m.quantidadeAlvo });
  };
  const porProduto = new Map<string, { c: number; q: number }>();
  const porVendedor = new Map<string, { c: number; q: number }>();
  const geral = { c: 0, q: 0 };
  for (const m of metas) {
    somar(porProduto, m.produtoId, m);
    somar(porVendedor, m.vendedorId, m);
    geral.c += centavos(m.valorAlvo);
    geral.q += m.quantidadeAlvo;
  }
  const comoTotal = (g: { c: number; q: number }): Total => ({ valor: (g.c / 100).toFixed(2), quantidade: g.q });
  const paraObjeto = (grupos: Map<string, { c: number; q: number }>) =>
    Object.fromEntries([...grupos].map(([id, g]) => [id, comoTotal(g)]));
  return { porProduto: paraObjeto(porProduto), porVendedor: paraObjeto(porVendedor), geral: comoTotal(geral) };
}
