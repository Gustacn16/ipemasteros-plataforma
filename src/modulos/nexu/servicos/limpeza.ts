import "server-only";
import { prisma } from "@/lib/prisma";

export const RETENCAO_DIAS = 90;

/** Apaga (exclusão física, LGPD) as conversas sem atividade há mais de 90 dias. As mensagens e propostas vão em cascata. */
export async function limparConversasAntigas(agora: Date = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - RETENCAO_DIAS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.conversaNexu.deleteMany({ where: { atualizadoEm: { lt: limite } } });
  return count;
}
