import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DIAS_RETENCAO } from "../regras/captura";

const LOTE = 5000;

/**
 * Apaga em lotes (o deleteMany do Prisma não tem `take`): escolhe os ids e apaga até vir menos que um lote.
 * O filtro é conferido de novo no delete: o que deixou de casar no meio do caminho fica.
 */
async function apagarEmLotes(where: Prisma.MensagemWhatsappWhereInput): Promise<number> {
  let total = 0;
  for (;;) {
    const lote = await prisma.mensagemWhatsapp.findMany({ where, select: { id: true }, take: LOTE });
    if (lote.length === 0) break;
    const { count } = await prisma.mensagemWhatsapp.deleteMany({ where: { ...where, id: { in: lote.map((m) => m.id) } } });
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
    // O grupo pode ter virado monitorado depois da busca: a condição vai junto em cada passo.
    provisorias = await apagarEmLotes({ conversaId: { in: ids }, conversa: { monitorada: false, tipo: "grupo" } });
    await prisma.conversaWhatsapp.updateMany({ where: { id: { in: ids }, monitorada: false }, data: { provisoriaAte: null } });
  }
  const limite = new Date(agora.getTime() - DIAS_RETENCAO * 24 * 60 * 60 * 1000);
  const antigas = await apagarEmLotes({ enviadaEm: { lt: limite } });
  return { provisorias, antigas };
}
