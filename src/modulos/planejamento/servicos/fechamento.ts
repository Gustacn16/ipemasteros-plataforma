import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { escolherMetaDoMes, mesesParaCongelar, retratarMes, type RetratoMes } from "../regras/fechamento";
import type { PremissasFunil } from "../regras/funil";
import { dataDoMes, mesDaData, mesesDoAno } from "../regras/meses";
import { metasDeVendas, type MetasPorProduto } from "../regras/turmas";
import { centavos } from "./acesso";

type Cliente = Prisma.TransactionClient | typeof prisma;

async function lerPlano(db: Cliente, planoId: string) {
  const plano = await db.planoAnual.findUnique({
    where: { id: planoId },
    include: {
      premissas: true,
      turmas: { where: { excluidoEm: null } },
      metasAvulsas: true,
      fechamentos: true,
    },
  });
  if (!plano) throw new ErroNegocio("Plano não encontrado.");
  return plano;
}
type PlanoLido = Awaited<ReturnType<typeof lerPlano>>;

export const premissasFunilDe = (p: {
  convLeadAgendada: { toNumber(): number };
  comparecimento: { toNumber(): number };
  convReuniaoVenda: { toNumber(): number };
  custoPorLead: { toNumber(): number };
  comissaoPct: { toNumber(): number };
  tetoCacPct: { toNumber(): number };
}): PremissasFunil => ({
  convLeadAgendada: p.convLeadAgendada.toNumber(),
  comparecimento: p.comparecimento.toNumber(),
  convReuniaoVenda: p.convReuniaoVenda.toNumber(),
  custoPorLeadCentavos: centavos(p.custoPorLead),
  comissaoPct: p.comissaoPct.toNumber(),
  tetoCacPct: p.tetoCacPct.toNumber(),
});

/** Cálculo do plano como está agora (sem retratos). */
function calcular(plano: PlanoLido) {
  const premissasFunil = premissasFunilDe(plano);
  const metas = metasDeVendas(
    plano.ano,
    plano.premissas.map((p) => ({
      produtoId: p.produtoId,
      contratoCentavos: centavos(p.contratoMedio),
      alunosPorTurma: p.alunosPorTurma,
      janelaVendasMeses: p.janelaVendasMeses,
      duracaoMeses: p.duracaoMeses,
    })),
    plano.turmas.map((t) => ({
      id: t.id,
      produtoId: t.produtoId,
      codigo: t.codigo,
      mesAbertura: mesDaData(t.mesAbertura),
      alunos: t.alunos,
      contratoCentavos: t.contratoMedio === null ? null : centavos(t.contratoMedio),
      janelaVendasMeses: t.janelaVendasMeses,
      duracaoMeses: t.duracaoMeses,
    })),
    plano.metasAvulsas.map((a) => ({ produtoId: a.produtoId, mes: mesDaData(a.mes), alunos: a.alunos, valorCentavos: centavos(a.valor) })),
  );
  return { premissasFunil, ...metas };
}

/** Guarda o retrato dos meses fechados que ainda não têm. Chamar antes de qualquer mudança no plano. */
export async function congelarMesesFechados(planoId: string, hoje: string, db: Cliente = prisma) {
  const plano = await lerPlano(db, planoId);
  const faltam = mesesParaCongelar(plano.ano, hoje, plano.fechamentos.map((f) => mesDaData(f.mes)));
  if (faltam.length === 0) return;
  const { porMes, premissasFunil } = calcular(plano);
  await db.fechamentoMesPlano.createMany({
    data: faltam.map((mes) => ({
      planoId,
      mes: dataDoMes(mes),
      dados: retratarMes(porMes[mes], premissasFunil) as unknown as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
}

export type PlanoCalculado = {
  plano: { id: string; ano: number; observacoes: string | null };
  premissasFunil: PremissasFunil;
  porMes: Record<string, RetratoMes>;
  antes: MetasPorProduto;
  depois: MetasPorProduto;
  congelados: string[];
  produtosDoPlano: string[];
};

/** Plano com as metas de cada mês, já respeitando os meses congelados. */
export async function carregarPlanoCalculado(planoId: string, hoje: string): Promise<PlanoCalculado> {
  await congelarMesesFechados(planoId, hoje);
  const plano = await lerPlano(prisma, planoId);
  const calc = calcular(plano);
  const retratos = Object.fromEntries(plano.fechamentos.map((f) => [mesDaData(f.mes), f.dados as unknown as RetratoMes]));
  const porMes = Object.fromEntries(
    mesesDoAno(plano.ano).map((mes) => [mes, escolherMetaDoMes(mes, hoje, retratos, retratarMes(calc.porMes[mes], calc.premissasFunil))]),
  );
  const produtosDoPlano = [
    ...new Set([...plano.premissas.map((p) => p.produtoId), ...plano.turmas.map((t) => t.produtoId), ...plano.metasAvulsas.map((a) => a.produtoId)]),
  ];
  return {
    plano: { id: plano.id, ano: plano.ano, observacoes: plano.observacoes },
    premissasFunil: calc.premissasFunil,
    porMes,
    antes: calc.antes,
    depois: calc.depois,
    congelados: Object.keys(retratos),
    produtosDoPlano,
  };
}

/** Roda uma mudança no plano depois de congelar os meses fechados, na mesma transação. */
export async function mudarPlano<T>(planoId: string, hoje: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await congelarMesesFechados(planoId, hoje, tx);
    return fn(tx);
  });
}
