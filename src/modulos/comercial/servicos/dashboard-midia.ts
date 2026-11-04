import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { mesesDaJanela, variacao } from "../regras/dashboard";
import { mesAnterior, mesSeguinte, primeiroDiaDoMes } from "../regras/meta";
import { type FiltroCampanhas, cac, custoPorLead, filtrandoCampanhas, filtrosValidos, roas, totalLeads } from "../regras/midia";
import { exigirPermissaoComercial } from "./acesso";

const MESES_DA_SERIE = 12;
const dataDoMes = (mes: string) => new Date(`${primeiroDiaDoMes(mes)}T00:00:00Z`);
const centavos = (v: { toString(): string } | null | undefined) => Math.round(Number(v ?? 0) * 100);
const reais = (c: number) => (c / 100).toFixed(2);
const mesDaData = (d: Date) => d.toISOString().slice(0, 7);

/** Só contas desligadas da importação ou em outra moeda ficam fora das somas (spec 5.7). */
const CONTA_VALIDA: Prisma.ContaAnuncioWhereInput = { ativa: true, moeda: "BRL" };

/**
 * Números de mídia do dashboard (spec Meta Ads, seção 5.9, com os filtros de
 * campanha pedidos em 2026-11-04). Com filtro de campanha, CAC e ROAS ficam `null`.
 */
export async function obterMidia(ator: UsuarioAtual, filtros: FiltroCampanhas & { mes: string }) {
  exigirPermissaoComercial(ator, "comercial:ver_marketing");
  const { mes } = filtros;
  const meses = mesesDaJanela(mes, MESES_DA_SERIE);
  const inicioJanela = dataDoMes(meses[0]!);
  const fimJanela = dataDoMes(mesSeguinte(mes));

  // Primeiro as opções dos filtros: com elas, conta e campanhas inválidas na URL são descartadas.
  const [contas, campanhasOpcoes, ultima, vendasDoMes] = await Promise.all([
    prisma.contaAnuncio.findMany({ where: CONTA_VALIDA, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.campanhaAnuncio.findMany({
      where: { conta: CONTA_VALIDA },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, contaId: true, status: true, conta: { select: { nome: true } } },
    }),
    prisma.importacaoAnuncios.findFirst({
      where: { status: "concluida" },
      orderBy: { finalizadoEm: "desc" },
      select: { finalizadoEm: true },
    }),
    prisma.venda.aggregate({
      where: { excluidoEm: null, dataVenda: { gte: dataDoMes(mes), lt: fimJanela } },
      _sum: { valorTotal: true },
      _count: true,
    }),
  ]);
  const f = filtrosValidos(filtros, { contas: contas.map((c) => c.id), campanhas: campanhasOpcoes });

  const filtroCampanha: Prisma.CampanhaAnuncioWhereInput = {
    conta: CONTA_VALIDA,
    ...(f.conta ? { contaId: f.conta } : {}),
    ...(f.busca ? { nome: { contains: f.busca } } : {}),
    ...(f.situacao === "ativas" ? { status: "ACTIVE" } : f.situacao === "pausadas" ? { status: { not: "ACTIVE" } } : {}),
  };
  const metricas = await prisma.metricaDiariaAnuncio.findMany({
    where: {
      data: { gte: inicioJanela, lt: fimJanela },
      campanha: filtroCampanha,
      ...(f.campanhas.length ? { campanhaId: { in: f.campanhas } } : {}),
    },
    select: { campanhaId: true, data: true, investimento: true, leadsFormulario: true, leadsSite: true, conversasIniciadas: true },
  });

  // Série mês a mês (zero nos meses sem investimento) e totais por campanha no mês do filtro.
  const porMes = new Map(meses.map((m) => [m, { investimento: 0, leads: 0 }]));
  const atual = { investimento: 0, leadsFormulario: 0, leadsSite: 0, conversasIniciadas: 0 };
  let investimentoAnterior = 0;
  const porCampanha = new Map<string, { investimento: number; leads: number }>();
  for (const m of metricas) {
    const mesDaMetrica = mesDaData(m.data);
    const investimento = centavos(m.investimento);
    const leads = totalLeads(m);
    const linha = porMes.get(mesDaMetrica);
    if (linha) {
      linha.investimento += investimento;
      linha.leads += leads;
    }
    if (mesDaMetrica === mesAnterior(mes)) investimentoAnterior += investimento;
    if (mesDaMetrica === mes) {
      atual.investimento += investimento;
      atual.leadsFormulario += m.leadsFormulario;
      atual.leadsSite += m.leadsSite;
      atual.conversasIniciadas += m.conversasIniciadas;
      const c = porCampanha.get(m.campanhaId) ?? { investimento: 0, leads: 0 };
      porCampanha.set(m.campanhaId, { investimento: c.investimento + investimento, leads: c.leads + leads });
    }
  }

  const leads = totalLeads(atual);
  const vendas = vendasDoMes._count;
  const vendido = centavos(vendasDoMes._sum.valorTotal);
  const semTotais = filtrandoCampanhas(f);
  const nomePorCampanha = new Map(campanhasOpcoes.map((c) => [c.id, c]));

  return {
    mes,
    conectada: ultima !== null,
    atualizadoEm: ultima?.finalizadoEm?.toISOString() ?? null,
    filtrando: semTotais,
    numeros: {
      investimento: reais(atual.investimento),
      variacaoInvestimento: variacao(reais(atual.investimento), reais(investimentoAnterior)),
      leads,
      leadsFormulario: atual.leadsFormulario,
      leadsSite: atual.leadsSite,
      conversasIniciadas: atual.conversasIniciadas,
      cpl: custoPorLead(atual.investimento, leads),
      cac: semTotais ? null : cac(atual.investimento, vendas, mes),
      roas: semTotais ? null : roas(vendido, atual.investimento, mes),
      vendas,
      vendido: reais(vendido),
    },
    serie: meses.map((m) => ({ mes: m, investimento: reais(porMes.get(m)!.investimento), leads: porMes.get(m)!.leads })),
    campanhas: [...porCampanha]
      .filter(([, c]) => c.investimento > 0 || c.leads > 0)
      .map(([id, c]) => ({
        id,
        nome: nomePorCampanha.get(id)?.nome ?? "—",
        conta: nomePorCampanha.get(id)?.conta.nome ?? "—",
        status: nomePorCampanha.get(id)?.status ?? "—",
        investimento: reais(c.investimento),
        leads: c.leads,
        cpl: custoPorLead(c.investimento, c.leads),
      }))
      .sort((a, b) => Number(b.investimento) - Number(a.investimento) || a.nome.localeCompare(b.nome, "pt-BR")),
    opcoes: { contas, campanhas: campanhasOpcoes.map((c) => ({ id: c.id, nome: c.nome, contaId: c.contaId, status: c.status })) },
  };
}
export type DadosMidia = Awaited<ReturnType<typeof obterMidia>>;
