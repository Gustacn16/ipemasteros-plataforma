import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosAluno, DadosMatricula } from "../esquemas/academico";
import { nomeBusca } from "../regras/normalizar";
import { MENSAGEM_NAO_ENCONTRADO, camposAlterados, deDia, exigirPermissaoAcademico, paraDia } from "./acesso";

const JA_NA_TURMA = "Este aluno já está nesta turma.";

/** Todos os alunos; a busca por nome é feita na tela (nome não vai para a URL). */
export async function listarAlunos(ator: UsuarioAtual) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const alunos = await prisma.aluno.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      nomeBusca: true,
      matriculas: {
        where: { turma: { excluidoEm: null } },
        select: { id: true, situacao: true, turma: { select: { nome: true, produto: { select: { nome: true } } } } },
      },
    },
  });
  return alunos.map((a) => ({
    id: a.id,
    nome: a.nome,
    nomeBusca: a.nomeBusca,
    matriculas: a.matriculas.map((m) => ({ id: m.id, situacao: m.situacao, produto: m.turma.produto.nome, turma: m.turma.nome })),
  }));
}
export type AlunoLista = Awaited<ReturnType<typeof listarAlunos>>[number];

/** Para o campo "Adicionar aluno" da turma. */
export async function listarOpcoesAluno() {
  return prisma.aluno.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export async function obterAluno(ator: UsuarioAtual, id: string) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      matriculas: {
        where: { turma: { excluidoEm: null } },
        orderBy: { criadoEm: "asc" },
        include: { turma: { select: { id: true, nome: true, produto: { select: { nome: true } } } } },
      },
    },
  });
  if (!aluno) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return {
    ...aluno,
    matriculas: aluno.matriculas.map((m) => ({
      ...m,
      dataInicio: deDia(m.dataInicio),
      dataFormatura: deDia(m.dataFormatura),
    })),
  };
}
export type AlunoDetalhe = Awaited<ReturnType<typeof obterAluno>>;

export async function criarAluno(ator: UsuarioAtual, dados: DadosAluno) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  return prisma.$transaction(async (tx) => {
    const aluno = await tx.aluno.create({ data: { ...dados, nomeBusca: nomeBusca(dados.nome) }, select: { id: true } });
    await registrarAuditoria({ usuarioId: ator.id, acao: "aluno.criado", entidade: "Aluno", entidadeId: aluno.id }, tx);
    return aluno;
  });
}

export async function editarAluno(ator: UsuarioAtual, id: string, dados: DadosAluno) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  await prisma.$transaction(async (tx) => {
    const antes = await tx.aluno.findUnique({ where: { id } });
    if (!antes) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    await tx.aluno.update({ where: { id }, data: { ...dados, nomeBusca: nomeBusca(dados.nome) } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "aluno.editado", entidade: "Aluno", entidadeId: id, diff: { campos: camposAlterados(antes, dados) } },
      tx,
    );
  });
}

/** Campos editáveis da matrícula; a turma fica de fora. */
const matriculaParaBanco = (d: DadosMatricula) => ({
  situacao: d.situacao,
  dataInicio: paraDia(d.dataInicio),
  dataFormatura: paraDia(d.dataFormatura),
  vigencia: d.vigencia,
  plano: d.plano,
  observacoes: d.observacoes,
});

const ehDuplicada = (erro: unknown) => erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";

export async function matricularAluno(ator: UsuarioAtual, alunoId: string, dados: DadosMatricula) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  try {
    return await prisma.$transaction(async (tx) => {
      const [aluno, turma] = await Promise.all([
        tx.aluno.findUnique({ where: { id: alunoId }, select: { id: true } }),
        tx.turma.findFirst({ where: { id: dados.turmaId, excluidoEm: null, produto: { excluidoEm: null } }, select: { id: true } }),
      ]);
      if (!aluno) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
      if (!turma) throw new ErroNegocio("Turma não encontrada.");
      const matricula = await tx.matricula.create({
        data: { alunoId, turmaId: dados.turmaId, ...matriculaParaBanco(dados) },
        select: { id: true },
      });
      await registrarAuditoria({ usuarioId: ator.id, acao: "matricula.criada", entidade: "Matricula", entidadeId: matricula.id }, tx);
      return matricula;
    });
  } catch (erro) {
    if (ehDuplicada(erro)) throw new ErroNegocio(JA_NA_TURMA);
    throw erro;
  }
}

/** Edita situação, datas e textos. A turma da matrícula não muda (`dados.turmaId` é ignorado). */
export async function editarMatricula(ator: UsuarioAtual, id: string, dados: DadosMatricula) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  await prisma.$transaction(async (tx) => {
    const antes = await tx.matricula.findUnique({ where: { id } });
    if (!antes) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    const novo = matriculaParaBanco(dados);
    await tx.matricula.update({ where: { id }, data: novo });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "matricula.editada", entidade: "Matricula", entidadeId: id, diff: { campos: camposAlterados(antes, novo) } },
      tx,
    );
  });
}
