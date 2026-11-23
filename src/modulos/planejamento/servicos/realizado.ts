import "server-only";
import { prisma } from "@/lib/prisma";
import { totalLeads } from "@/modulos/comercial/regras/midia";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import type { Fonte, ParametrosFonte } from "../regras/fontes";
import { dataDoMes, mesComecou, mesDaData, mesesDoAno, somarMeses } from "../regras/meses";
import { centavos } from "./acesso";

export type BaseMes = { vendasCentavos: number; alunos: number; leads: number; investimentoCentavos: number };
export type SerieMensal = Record<string, number | null>;

type IndicadorFonte = { id: string; fonte: string; fonteParametros: unknown };

/**
 * Vendas, leads e investimento de cada mês do ano (para as fontes e para o CAC e a conversão).
 * `produtosDoPlano` nulo = todas as vendas (ano ainda sem plano).
 */
export async function baseDoAno(ano: number, produtosDoPlano: string[] | null): Promise<Record<string, BaseMes>> {
  const inicio = dataDoMes(`${ano}-01`);
  const fim = dataDoMes(`${ano + 1}-01`);
  const [vendas, metricas] = await Promise.all([
    prisma.venda.findMany({
      where: { excluidoEm: null, ...(produtosDoPlano ? { produtoId: { in: produtosDoPlano } } : {}), dataVenda: { gte: inicio, lt: fim } },
      select: { dataVenda: true, valorTotal: true },
    }),
    // Mesmas contas da visão Mídia do Comercial: ativas e em reais.
    prisma.metricaDiariaAnuncio.findMany({
      where: { data: { gte: inicio, lt: fim }, campanha: { conta: { ativa: true, moeda: "BRL" } } },
      select: { data: true, investimento: true, leadsFormulario: true, leadsSite: true, conversasIniciadas: true },
    }),
  ]);
  const base: Record<string, BaseMes> = Object.fromEntries(
    mesesDoAno(ano).map((m) => [m, { vendasCentavos: 0, alunos: 0, leads: 0, investimentoCentavos: 0 }]),
  );
  for (const v of vendas) {
    const b = base[mesDaData(v.dataVenda)];
    if (b) {
      b.vendasCentavos += centavos(v.valorTotal);
      b.alunos += 1;
    }
  }
  for (const m of metricas) {
    const b = base[mesDaData(m.data)];
    if (b) {
      b.leads += totalLeads(m);
      b.investimentoCentavos += centavos(m.investimento);
    }
  }
  return base;
}

async function seguidoresPorMes(ano: number, contaId: string): Promise<SerieMensal> {
  const linhas = await prisma.metricaContaInstagram.findMany({
    where: { contaId, periodo: "dia", seguidores: { not: null }, data: { gte: dataDoMes(`${ano}-01`), lt: dataDoMes(`${ano + 1}-01`) } },
    orderBy: { data: "asc" },
    select: { data: true, seguidores: true },
  });
  const serie: SerieMensal = {};
  for (const l of linhas) serie[mesDaData(l.data)] = l.seguidores; // o último dia com dado fica
  return serie;
}

async function alcancePorMes(ano: number, contaId: string): Promise<SerieMensal> {
  const linhas = await prisma.metricaContaInstagram.findMany({
    where: { contaId, periodo: "mes", data: { in: mesesDoAno(ano).map(dataDoMes) } },
    select: { data: true, alcance: true },
  });
  return Object.fromEntries(linhas.map((l) => [mesDaData(l.data), l.alcance]));
}

async function publicadosPorMes(ano: number, p: ParametrosFonte): Promise<SerieMensal> {
  if (!p.canalId) return {};
  // Margem de um dia nas pontas: o mês é contado no fuso de São Paulo.
  const linhas = await prisma.publicacao.findMany({
    where: {
      canalId: p.canalId,
      status: "publicado",
      publicadoEm: { gte: dataDoMes(somarMeses(`${ano}-01`, -1)), lt: dataDoMes(somarMeses(`${ano + 1}-01`, 1)) },
      ...(p.formatoIds?.length ? { conteudo: { formatoId: { in: p.formatoIds } } } : {}),
    },
    select: { publicadoEm: true },
  });
  const serie: SerieMensal = Object.fromEntries(mesesDoAno(ano).map((m) => [m, 0]));
  for (const l of linhas) {
    const mes = diaEmSaoPaulo(l.publicadoEm!).slice(0, 7);
    if (mes in serie) serie[mes] = (serie[mes] ?? 0) + 1;
  }
  return serie;
}

/**
 * Realizado de cada indicador automático, mês a mês. Meses que ainda não começaram ficam `null`.
 * Dinheiro sai em reais (número). Conversão em fração.
 */
export async function realizadoAutomatico(
  plano: { ano: number; comissaoPct: number; produtosDoPlano: string[] },
  indicadores: IndicadorFonte[],
  hoje: string,
): Promise<{ porIndicador: Record<string, SerieMensal>; base: Record<string, BaseMes> }> {
  const base = await baseDoAno(plano.ano, plano.produtosDoPlano);
  const meses = mesesDoAno(plano.ano);
  const daBase = (f: (b: BaseMes) => number | null): SerieMensal => Object.fromEntries(meses.map((m) => [m, f(base[m])]));
  const porIndicador: Record<string, SerieMensal> = {};
  for (const i of indicadores) {
    const p = (i.fonteParametros ?? {}) as ParametrosFonte;
    let serie: SerieMensal;
    switch (i.fonte as Fonte) {
      case "vendas_valor":
        serie = daBase((b) => b.vendasCentavos / 100);
        break;
      case "vendas_alunos":
        serie = daBase((b) => b.alunos);
        break;
      case "meta_leads":
        serie = daBase((b) => b.leads);
        break;
      case "meta_investimento":
        serie = daBase((b) => b.investimentoCentavos / 100);
        break;
      case "calc_conversao":
        serie = daBase((b) => (b.leads === 0 ? null : b.alunos / b.leads));
        break;
      case "calc_cac":
        serie = daBase((b) => cacReais(b, plano.comissaoPct));
        break;
      case "instagram_seguidores":
        serie = p.contaId ? await seguidoresPorMes(plano.ano, p.contaId) : {};
        break;
      case "instagram_alcance":
        serie = p.contaId ? await alcancePorMes(plano.ano, p.contaId) : {};
        break;
      case "conteudos_publicados":
        serie = await publicadosPorMes(plano.ano, p);
        break;
      default:
        continue;
    }
    porIndicador[i.id] = Object.fromEntries(meses.map((m) => [m, mesComecou(m, hoje) ? (serie[m] ?? null) : null]));
  }
  return { porIndicador, base };
}

/** CAC por aluno em reais: (mídia + comissão estimada) ÷ alunos. Sem venda → null. */
export function cacReais(b: BaseMes, comissaoPct: number): number | null {
  if (b.alunos === 0) return null;
  return (b.investimentoCentavos + b.vendasCentavos * comissaoPct) / 100 / b.alunos;
}
