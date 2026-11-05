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

/** Vendedores a conferir ao salvar: só os das linhas preenchidas (linha vazia só apaga). */
export function vendedoresParaValidar(linhas: { vendedorId: string; valorAlvo: string; quantidadeAlvo: number }[]): string[] {
  return [...new Set(linhas.filter((l) => !metaVazia(l)).map((l) => l.vendedorId))];
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

type VendedorMeta = { id: string; nome: string; imagem: string | null };

export type ProgressoVendedor = {
  id: string;
  nome: string;
  foto: string | null;
  metaValor: string;
  metaQuantidade: number;
  vendido: string;
  vendas: number;
  /** Vendido ÷ meta (valor), em % inteiro; `null` sem meta. */
  percentual: number | null;
  /** Quanto falta para a meta (nunca negativo). */
  falta: string;
};

/**
 * Progresso do mês por vendedor e no total, para a visão das metas. Ordena pelo %
 * da meta (sem meta no fim) e monta o pódio com os 3 melhores entre quem tem meta.
 */
export function progressoDasMetas(o: {
  vendedores: VendedorMeta[];
  metas: { vendedorId: string; valorAlvo: string; quantidadeAlvo: number }[];
  vendas: { vendedorId: string; vendido: string; quantidade: number }[];
}): { vendedores: ProgressoVendedor[]; total: Omit<ProgressoVendedor, "id" | "nome" | "foto">; podio: ProgressoVendedor[] } {
  const linha = (metaC: number, metaQ: number, vendidoC: number, vendas: number) => ({
    metaValor: (metaC / 100).toFixed(2),
    metaQuantidade: metaQ,
    vendido: (vendidoC / 100).toFixed(2),
    vendas,
    percentual: metaC === 0 ? null : Math.round((vendidoC / metaC) * 100),
    falta: (Math.max(0, metaC - vendidoC) / 100).toFixed(2),
  });

  let totalMeta = 0;
  let totalMetaQ = 0;
  let totalVendido = 0;
  let totalVendas = 0;
  const vendedores = o.vendedores.map((v) => {
    const minhas = o.metas.filter((m) => m.vendedorId === v.id);
    const metaC = minhas.reduce((s, m) => s + centavos(m.valorAlvo), 0);
    const metaQ = minhas.reduce((s, m) => s + m.quantidadeAlvo, 0);
    const venda = o.vendas.find((x) => x.vendedorId === v.id);
    const vendidoC = venda ? centavos(venda.vendido) : 0;
    const vendas = venda?.quantidade ?? 0;
    totalMeta += metaC;
    totalMetaQ += metaQ;
    totalVendido += vendidoC;
    totalVendas += vendas;
    return { id: v.id, nome: v.nome, foto: v.imagem, ...linha(metaC, metaQ, vendidoC, vendas) };
  });
  vendedores.sort(
    (a, b) => (b.percentual ?? -1) - (a.percentual ?? -1) || Number(b.vendido) - Number(a.vendido) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return {
    vendedores,
    total: linha(totalMeta, totalMetaQ, totalVendido, totalVendas),
    podio: vendedores.filter((v) => v.percentual !== null).slice(0, 3),
  };
}
