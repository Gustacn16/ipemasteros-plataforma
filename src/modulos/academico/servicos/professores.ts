import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosProfessor } from "../esquemas/academico";
import { MENSAGEM_NAO_ENCONTRADO, camposAlterados, exigirPermissaoAcademico } from "./acesso";

export async function listarProfessores(ator: UsuarioAtual) {
  exigirPermissaoAcademico(ator, "academico:ver");
  return prisma.professor.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, nome: true, especialidade: true, ativo: true },
  });
}

export async function obterProfessor(ator: UsuarioAtual, id: string) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const professor = await prisma.professor.findUnique({ where: { id } });
  if (!professor) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return professor;
}
export type ProfessorDetalhe = Awaited<ReturnType<typeof obterProfessor>>;

export async function criarProfessor(ator: UsuarioAtual, dados: DadosProfessor) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  return prisma.$transaction(async (tx) => {
    const professor = await tx.professor.create({ data: dados, select: { id: true } });
    await registrarAuditoria({ usuarioId: ator.id, acao: "professor.criado", entidade: "Professor", entidadeId: professor.id }, tx);
    return professor;
  });
}

export async function editarProfessor(ator: UsuarioAtual, id: string, dados: DadosProfessor) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  await prisma.$transaction(async (tx) => {
    const antes = await tx.professor.findUnique({ where: { id } });
    if (!antes) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    await tx.professor.update({ where: { id }, data: dados });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "professor.editado", entidade: "Professor", entidadeId: id, diff: { campos: camposAlterados(antes, dados) } },
      tx,
    );
  });
}

export async function definirAtivoProfessor(ator: UsuarioAtual, id: string, ativo: boolean) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.professor.updateMany({ where: { id }, data: { ativo } });
    if (count === 0) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "professor.editado", entidade: "Professor", entidadeId: id, diff: { campos: ["ativo"] } },
      tx,
    );
  });
}
