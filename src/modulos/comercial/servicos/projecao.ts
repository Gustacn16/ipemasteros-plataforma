import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import type { FiltrosDashboard } from "../esquemas/dashboard";
import { mesesDaJanela } from "../regras/dashboard";
import { totalLeads } from "../regras/midia";
import { mesSeguinte, primeiroDiaDoMes } from "../regras/meta";
import { projetarMes, type Projecao } from "../regras/projecao";
import { exigirPermissaoComercial } from "./acesso";

/** Meses anteriores usados como base da conversão e do ticket. */
export const MESES_BASE = 6;

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const centavos = (v: { toString(): string } | null | undefined) => Math.round(Number(v ?? 0) * 100);
const mesDaData = (d: Date) => d.toISOString().slice(0, 7);

export type DadosProjecao = Projecao & {
  /** Por que não há leads na conta (para a nota da tela). */
  semLeads: "permissao" | "filtro" | null;
};

/**
 * Projeção de fechamento do mês do filtro. Usa as mesmas regras de visão do
 * dashboard (o vendedor vê só os próprios números). Leads só entram para quem
 * vê mídia e sem filtro de produto ou vendedor, porque os leads da Meta ainda
 * não são ligados a produto nem a vendedor.
 */
export async function obterProjecao(ator: UsuarioAtual, filtros: FiltrosDashboard): Promise<DadosProjecao> {
  exigirPermissaoComercial(ator, "comercial:ver");
  const equipe = temPermissao(ator.papel, "comercial:ver_equipe");
  const vendedorId = equipe ? filtros.vendedor : ator.id;
  const { mes } = filtros;
  const hoje = diaEmSaoPaulo(new Date());

  const meses = mesesDaJanela(mes, MESES_BASE + 1);
  const anteriores = meses.slice(0, -1);
  const inicio = dataDoDia(primeiroDiaDoMes(meses[0]!));
  const inicioMes = dataDoDia(primeiroDiaDoMes(mes));
  const fim = dataDoDia(primeiroDiaDoMes(mesSeguinte(mes)));

  const semLeads: DadosProjecao["semLeads"] = !temPermissao(ator.papel, "comercial:ver_marketing")
    ? "permissao"
    : filtros.produto || vendedorId
      ? "filtro"
      : null;

  const filtroVendas: Prisma.VendaWhereInput = {
    excluidoEm: null,
    dataVenda: { gte: inicio, lt: fim },
    ...(vendedorId ? { vendedorId } : {}),
    ...(filtros.produto ? { produtoId: filtros.produto } : {}),
  };
  const [vendas, metas, metricas] = await Promise.all([
    prisma.venda.findMany({ where: filtroVendas, select: { dataVenda: true, valorTotal: true } }),
    prisma.metaVenda.aggregate({
      where: { mes: inicioMes, ...(vendedorId ? { vendedorId } : {}), ...(filtros.produto ? { produtoId: filtros.produto } : {}) },
      _sum: { valorAlvo: true },
    }),
    semLeads
      ? Promise.resolve([])
      : prisma.metricaDiariaAnuncio.findMany({
          // Mesmas contas da visão Mídia: ativas e em reais. No mês atual, só até hoje.
          where: { data: { gte: inicio, lt: fim, lte: dataDoDia(hoje) }, campanha: { conta: { ativa: true, moeda: "BRL" } } },
          select: { data: true, leadsFormulario: true, leadsSite: true, conversasIniciadas: true },
        }),
  ]);

  const porMes = new Map(meses.map((m) => [m, { vendido: 0, vendas: 0, leads: 0 }]));
  for (const v of vendas) {
    const linha = porMes.get(mesDaData(v.dataVenda));
    if (linha) {
      linha.vendido += centavos(v.valorTotal);
      linha.vendas += 1;
    }
  }
  for (const m of metricas) {
    const linha = porMes.get(mesDaData(m.data));
    if (linha) linha.leads += totalLeads(m);
  }

  const atual = porMes.get(mes)!;
  const projecao = projetarMes({
    mes,
    hoje,
    vendido: atual.vendido,
    vendas: atual.vendas,
    meta: centavos(metas._sum.valorAlvo),
    leads: semLeads ? null : atual.leads,
    historico: anteriores.map((m) => {
      const l = porMes.get(m)!;
      return { mes: m, vendido: l.vendido, vendas: l.vendas, leads: semLeads ? null : l.leads };
    }),
  });
  return { ...projecao, semLeads };
}
