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
};

/** Registra só números (tokens e custo), nunca o texto da pergunta ou da resposta. Devolve o custo em micro-dólares. */
export async function registrarUsoIa(d: DadosUso): Promise<number> {
  const tokens = tokensDoUsage(d.usage);
  const custoMicroUsd = calcularCustoMicroUsd(d.modelo, tokens);
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

/** Perguntas do Nexu feitas hoje pela pessoa e gasto do mês (todas as origens) contra os limites configurados. */
export async function situacaoLimites(usuarioId: string, agora: Date = new Date()): Promise<ReturnType<typeof avaliarLimites>> {
  const config = await obterConfiguracaoIa();
  const [perguntasHoje, soma] = await Promise.all([
    prisma.usoIa.count({
      where: { origem: "nexu", usuarioId, inicioPergunta: true, criadoEm: { gte: inicioDoDiaSaoPaulo(agora) } },
    }),
    prisma.usoIa.aggregate({ _sum: { custoMicroUsd: true }, where: { criadoEm: { gte: inicioDoMesSaoPaulo(agora) } } }),
  ]);
  return avaliarLimites({
    perguntasHoje,
    perguntasPorDia: config.perguntasPorDia,
    gastoMesMicroUsd: soma._sum.custoMicroUsd ?? 0,
    limiteMensalMicroUsd: config.limiteMensalMicroUsd,
  });
}
