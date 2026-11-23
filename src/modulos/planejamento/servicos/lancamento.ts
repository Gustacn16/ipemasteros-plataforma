import "server-only";
import { prisma } from "@/lib/prisma";

/** Tem algum indicador manual sob sua responsabilidade num plano? (menu e acesso ao lançamento) */
export async function ehResponsavelNoPlanejamento(usuarioId: string): Promise<boolean> {
  const n = await prisma.indicadorPlano.count({ where: { responsavelId: usuarioId, excluidoEm: null, fonte: "manual" } });
  return n > 0;
}
