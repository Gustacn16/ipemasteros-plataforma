import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";

// Regras por registro do módulo Tarefas (docs/04-seguranca-permissoes.md):
// colaborador só vê espaços em que é membro; professor só vê as tarefas em que
// é responsável; qualquer um acessa a tarefa de que é responsável. Registro
// fora do alcance responde "não encontrado" para não revelar que existe.

export const MENSAGEM_NAO_ENCONTRADO = "Não encontrado.";

export function exigirPermissaoTarefas(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}

/** Professor não navega em espaços (só vê Minhas tarefas). */
export function navegaEmEspacos(ator: UsuarioAtual): boolean {
  return temPermissao(ator.papel, "tarefas:usar") && ator.papel !== "professor";
}

export function filtroEspacosVisiveis(ator: UsuarioAtual): Prisma.EspacoWhereInput {
  if (temPermissao(ator.papel, "tarefas:ver_todos_espacos")) return { excluidoEm: null };
  if (!navegaEmEspacos(ator)) return { id: { in: [] } };
  return { excluidoEm: null, membros: { some: { usuarioId: ator.id } } };
}

export function filtroTarefasVisiveis(ator: UsuarioAtual): Prisma.TarefaWhereInput {
  return {
    excluidoEm: null,
    lista: { excluidoEm: null, espaco: { excluidoEm: null } },
    OR: [
      { responsaveis: { some: { usuarioId: ator.id } } },
      { lista: { espaco: filtroEspacosVisiveis(ator) } },
    ],
  };
}

export async function exigirEspaco(ator: UsuarioAtual, espacoId: string) {
  const espaco = await prisma.espaco.findFirst({
    where: { AND: [{ id: espacoId }, filtroEspacosVisiveis(ator)] },
  });
  if (!espaco) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return espaco;
}

export async function exigirLista(ator: UsuarioAtual, listaId: string) {
  const lista = await prisma.lista.findFirst({
    where: { id: listaId, excluidoEm: null, espaco: filtroEspacosVisiveis(ator) },
    include: { espaco: { select: { id: true, nome: true, cor: true } } },
  });
  if (!lista) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return lista;
}

export async function exigirTarefa(ator: UsuarioAtual, tarefaId: string) {
  const tarefa = await prisma.tarefa.findFirst({
    where: { AND: [{ id: tarefaId }, filtroTarefasVisiveis(ator)] },
    include: { lista: { select: { id: true, espacoId: true } }, status: { select: { tipo: true } } },
  });
  if (!tarefa) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return tarefa;
}

/** Editar campos da tarefa exige navegar no espaço; o professor só muda o status. */
export function podeEditarTarefa(ator: UsuarioAtual): boolean {
  return navegaEmEspacos(ator);
}

export function podeExcluirTarefa(ator: UsuarioAtual, tarefa: { criadoPorId: string }): boolean {
  return temPermissao(ator.papel, "tarefas:ver_todos_espacos") || tarefa.criadoPorId === ator.id;
}

/** Quem pode ser responsável numa tarefa do espaço: membros, mais admins e gestores. */
export async function usuariosAtribuiveis(espacoId: string) {
  return prisma.usuario.findMany({
    where: {
      ativo: true,
      OR: [{ papel: { in: ["admin", "gestor"] } }, { membroDeEspacos: { some: { espacoId } } }],
    },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}
