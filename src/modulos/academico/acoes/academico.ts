"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { z } from "zod";
import { SITUACOES_TURMA, esquemaAluno, esquemaMatricula, esquemaProfessor, esquemaTurma } from "../esquemas/academico";
import { criarAluno, editarAluno, editarMatricula, matricularAluno } from "../servicos/alunos";
import { criarProfessor, definirAtivoProfessor, editarProfessor } from "../servicos/professores";
import { criarTurma, definirSituacaoTurma, editarTurma, excluirTurma } from "../servicos/turmas";

const revalidarAcademico = () => revalidatePath("/academico", "layout");

const campo = (formData: FormData, nome: string) => {
  const v = formData.get(nome);
  return typeof v === "string" ? v : "";
};

// ─── Turmas ─────────────────────────────────────────────────────────────────

export async function criarTurmaAcao(_: EstadoAcao<{ id: string }>, formData: FormData): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    const turma = await criarTurma(ator, esquemaTurma.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Turma criada.", dados: { id: turma.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarTurmaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await editarTurma(ator, campo(formData, "id"), esquemaTurma.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Turma atualizada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirSituacaoTurmaAcao(id: string, situacao: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await definirSituacaoTurma(ator, id, z.enum(SITUACOES_TURMA).parse(situacao));
    revalidarAcademico();
    return { ok: true, mensagem: "Situação da turma atualizada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirTurmaAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await excluirTurma(ator, id);
    revalidarAcademico();
    return { ok: true, mensagem: "Turma excluída." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

// ─── Alunos e matrículas ────────────────────────────────────────────────────

export async function criarAlunoAcao(_: EstadoAcao<{ id: string }>, formData: FormData): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    const aluno = await criarAluno(ator, esquemaAluno.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Aluno cadastrado.", dados: { id: aluno.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarAlunoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await editarAluno(ator, campo(formData, "id"), esquemaAluno.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Aluno atualizado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

/** Matricula o aluno (`alunoId`) na turma (`turmaId`). */
export async function matricularAlunoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await matricularAluno(ator, campo(formData, "alunoId"), esquemaMatricula.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Matrícula criada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarMatriculaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    // A turma não muda na edição; o esquema exige o campo, então ele vem oculto.
    await editarMatricula(ator, campo(formData, "id"), esquemaMatricula.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Matrícula atualizada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

// ─── Professores ────────────────────────────────────────────────────────────

export async function criarProfessorAcao(_: EstadoAcao<{ id: string }>, formData: FormData): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    const professor = await criarProfessor(ator, esquemaProfessor.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Professor cadastrado.", dados: { id: professor.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarProfessorAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await editarProfessor(ator, campo(formData, "id"), esquemaProfessor.parse(dadosDoFormulario(formData)));
    revalidarAcademico();
    return { ok: true, mensagem: "Professor atualizado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirAtivoProfessorAcao(id: string, ativo: boolean): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("academico:gerenciar");
    await definirAtivoProfessor(ator, id, ativo);
    revalidarAcademico();
    return { ok: true, mensagem: ativo ? "Professor ativado." : "Professor desativado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
