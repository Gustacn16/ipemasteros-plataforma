import "server-only";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoIa } from "./configuracao";
import { avaliarLimites, inicioDoDiaSaoPaulo, inicioDoMesSaoPaulo } from "./limites";
import { calcularCustoMicroUsd, tokensDoUsage, type ModeloIa } from "./precos";

type DadosUso = {
  origem: string;
  usuarioId: string | null;
  modelo: ModeloIa;
  inicioPergunta: boolean;
  usage: Parameters<typeof tokensDoUsage>[0];
  /** Pedido feito pela API de lote: custa 50%. Padrão: false. */
  lote?: boolean;
};

/** Registra só números (tokens e custo), nunca o texto da pergunta ou da resposta. Devolve o custo em micro-dólares. */
export async function registrarUsoIa(d: DadosUso): Promise<number> {
  const tokens = tokensDoUsage(d.usage);
  const custoMicroUsd = calcularCustoMicroUsd(d.modelo, tokens, { lote: d.lote ?? false });
  await prisma.usoIa.create({
    data: {
      origem: d.origem,
      usuarioId: d.usuarioId,
      inicioPergunta: d.inicioPergunta,
      modelo: d.modelo,
      tokensEntrada: tokens.entrada,
      tokensCacheEscrita: tokens.cacheEscrita,
      tokensCacheLeitura: tokens.cacheLeitura,
      tokensSaida: tokens.saida,
      custoMicroUsd,
    },
  });
  return custoMicroUsd;
}

/** Gasto do mês (calendário de São Paulo) em micro-dólares, somando só a origem informada. */
export async function gastoMesMicroUsd(origem: string, agora: Date = new Date()): Promise<number> {
  const soma = await prisma.usoIa.aggregate({
    _sum: { custoMicroUsd: true },
    where: { origem, criadoEm: { gte: inicioDoMesSaoPaulo(agora) } },
  });
  return soma._sum.custoMicroUsd ?? 0;
}

/** Perguntas do Nexu feitas hoje pela pessoa e gasto do mês do Nexu contra os limites configurados. */
export async function situacaoLimites(usuarioId: string, agora: Date = new Date()): Promise<ReturnType<typeof avaliarLimites>> {
  const config = await obterConfiguracaoIa();
  const [perguntasHoje, gastoMes] = await Promise.all([
    prisma.usoIa.count({
      where: { origem: "nexu", usuarioId, inicioPergunta: true, criadoEm: { gte: inicioDoDiaSaoPaulo(agora) } },
    }),
    gastoMesMicroUsd("nexu", agora),
  ]);
  return avaliarLimites({
    perguntasHoje,
    perguntasPorDia: config.perguntasPorDia,
    gastoMesMicroUsd: gastoMes,
    limiteMensalMicroUsd: config.limiteMensalMicroUsd,
  });
}
