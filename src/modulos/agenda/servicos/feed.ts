import "server-only";
import type { Papel } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { diaDaDataEntrega } from "@/modulos/tarefas/regras/prazo";
import type { EventoIcs } from "../regras/ics";
import { filtroEventosVisiveis } from "../regras/visibilidade";

const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Eventos institucionais do feed .ics, filtrados pelo papel do dono do token. */
export async function eventosDoFeed(papel: Papel, de: string, ate: string): Promise<EventoIcs[]> {
  const linhas = await prisma.eventoInstitucional.findMany({
    where: { AND: [filtroEventosVisiveis(papel)], dataInicio: { lte: dia(ate) }, dataFim: { gte: dia(de) } },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      local: true,
      turma: true,
      dataInicio: true,
      dataFim: true,
      horaInicio: true,
      horaFim: true,
      atualizadoEm: true,
    },
    orderBy: [{ dataInicio: "asc" }, { horaInicio: "asc" }],
  });
  return linhas.map((e) => ({ ...e, dataInicio: diaDaDataEntrega(e.dataInicio), dataFim: diaDaDataEntrega(e.dataFim) }));
}
