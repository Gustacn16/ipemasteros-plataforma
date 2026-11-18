import "server-only";
import { obterConfiguracaoIa } from "@/lib/ia/configuracao";
import { inicioDoMesSaoPaulo } from "@/lib/ia/limites";
import { prisma } from "@/lib/prisma";

type ServicoExterno = "groq" | "dataforseo" | "apify";

/** Gasto do espião no mês de São Paulo: serviços externos + Claude com origem "espiao". */
export async function gastoEspiaoDoMes(agora: Date = new Date()): Promise<number> {
  const desde = inicioDoMesSaoPaulo(agora);
  const [externo, ia] = await Promise.all([
    prisma.gastoEspiao.aggregate({ _sum: { custoMicroUsd: true }, where: { criadoEm: { gte: desde } } }),
    prisma.usoIa.aggregate({ _sum: { custoMicroUsd: true }, where: { origem: "espiao", criadoEm: { gte: desde } } }),
  ]);
  return (externo._sum.custoMicroUsd ?? 0) + (ia._sum.custoMicroUsd ?? 0);
}

/**
 * Antes de cada passo pago. Sempre confere o teto do espião; o limite mensal geral da IA
 * (todas as origens) só vale para o Claude ("ia"). Serviço externo (Groq) conta só no teto do espião (D6).
 */
export async function podeGastar(
  agora: Date = new Date(),
  tipo: "ia" | "externo" = "ia",
): Promise<{ ok: true } | { ok: false; motivo: "teto_espiao" | "limite_geral" }> {
  const config = await obterConfiguracaoIa();
  const [doEspiao, geral] = await Promise.all([
    gastoEspiaoDoMes(agora),
    prisma.usoIa.aggregate({ _sum: { custoMicroUsd: true }, where: { criadoEm: { gte: inicioDoMesSaoPaulo(agora) } } }),
  ]);
  if (doEspiao >= config.limiteEspiaoMicroUsd) return { ok: false, motivo: "teto_espiao" };
  if (tipo === "ia" && (geral._sum.custoMicroUsd ?? 0) >= config.limiteMensalMicroUsd) return { ok: false, motivo: "limite_geral" };
  return { ok: true };
}

export async function registrarGastoExterno(d: {
  servico: ServicoExterno;
  quantidade: number;
  custoMicroUsd: number;
  coletaId: string | null;
  usuarioId: string | null;
}): Promise<void> {
  await prisma.gastoEspiao.create({ data: d });
}
