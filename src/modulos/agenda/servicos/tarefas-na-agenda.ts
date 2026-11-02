import "server-only";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaDaDataEntrega } from "@/modulos/tarefas/regras/prazo";
import { filtroTarefasVisiveis } from "@/modulos/tarefas/servicos/acesso";

export type TarefaNaAgenda = { id: string; titulo: string; dataEntrega: string; listaId: string };

/** Tarefas abertas do ator com entrega no intervalo (regra 8 da Agenda). */
export async function listarTarefasComEntrega(
  ator: UsuarioAtual,
  { de, ate }: { de: string; ate: string },
): Promise<TarefaNaAgenda[]> {
  if (!temPermissao(ator.papel, "tarefas:usar")) return [];
  const tarefas = await prisma.tarefa.findMany({
    where: {
      AND: [filtroTarefasVisiveis(ator)],
      responsaveis: { some: { usuarioId: ator.id } },
      concluidaEm: null,
      dataEntrega: { gte: new Date(`${de}T00:00:00.000Z`), lte: new Date(`${ate}T00:00:00.000Z`) },
    },
    orderBy: [{ dataEntrega: "asc" }, { titulo: "asc" }],
    select: { id: true, titulo: true, dataEntrega: true, listaId: true },
  });
  return tarefas.flatMap((t) =>
    t.dataEntrega ? [{ id: t.id, titulo: t.titulo, dataEntrega: diaDaDataEntrega(t.dataEntrega), listaId: t.listaId }] : [],
  );
}
