import "server-only";
import { prisma } from "@/lib/prisma";
import { DIAS_RETENCAO } from "../regras/captura";

const LOTE = 5000;

/** Apaga em lotes (o deleteMany do Prisma não tem `take`): escolhe os ids e apaga até vir menos que um lote. */
async function apagarEmLotes(where: Record<string, unknown>): Promise<number> {
  let total = 0;
  for (;;) {
    const lote = await prisma.mensagemWhatsapp.findMany({ where, select: { id: true }, take: LOTE });
    if (lote.length === 0) break;
    const { count } = await prisma.mensagemWhatsapp.deleteMany({ where: { id: { in: lote.map((m) => m.id) } } });
    total += count;
    if (lote.length < LOTE) break;
  }
  return total;
}

/**
 * Limpeza diária: apaga as mensagens provisórias vencidas de grupos que continuam não monitorados
 * (e zera `provisoriaAte`) e as mensagens com mais de 90 dias. Devolve só contagens.
 */
export async function limparWhatsapp(agora: Date = new Date()): Promise<{ provisorias: number; antigas: number }> {
  const vencidas = await prisma.conversaWhatsapp.findMany({
    where: { tipo: "grupo", monitorada: false, provisoriaAte: { lt: agora } },
    select: { id: true },
  });
  let provisorias = 0;
  if (vencidas.length > 0) {
    const ids = vencidas.map((c) => c.id);
    provisorias = await apagarEmLotes({ conversaId: { in: ids } });
    await prisma.conversaWhatsapp.updateMany({ where: { id: { in: ids } }, data: { provisoriaAte: null } });
  }
  const limite = new Date(agora.getTime() - DIAS_RETENCAO * 24 * 60 * 60 * 1000);
  const antigas = await apagarEmLotes({ enviadaEm: { lt: limite } });
  return { provisorias, antigas };
}
