import "server-only";
import { prisma } from "@/lib/prisma";
import { MODELOS_IA, type ModeloIa } from "./precos";

export type ConfiguracaoIa = { modelo: ModeloIa; limiteMensalMicroUsd: number; perguntasPorDia: number; limiteEspiaoMicroUsd: number };

const MODELO_PADRAO: ModeloIa = "claude-haiku-5-5";

/** Configuração da IA (linha "unica"); sem linha ou com modelo desconhecido, cai nos padrões. */
export async function obterConfiguracaoIa(): Promise<ConfiguracaoIa> {
  const linha = await prisma.configuracaoIa.findUnique({ where: { id: "unica" } });
  if (!linha) return { modelo: MODELO_PADRAO, limiteMensalMicroUsd: 20_000_000, perguntasPorDia: 50, limiteEspiaoMicroUsd: 10_000_000 };
  const modelo = (MODELOS_IA as readonly string[]).includes(linha.modelo) ? (linha.modelo as ModeloIa) : MODELO_PADRAO;
  return {
    modelo,
    limiteMensalMicroUsd: linha.limiteMensalMicroUsd,
    perguntasPorDia: linha.perguntasPorDia,
    limiteEspiaoMicroUsd: linha.limiteEspiaoMicroUsd,
  };
}
