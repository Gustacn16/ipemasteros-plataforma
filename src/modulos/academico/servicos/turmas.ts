import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosTurma, SituacaoTurma } from "../esquemas/academico";
import { nomeBusca } from "../regras/normalizar";
import { MENSAGEM_NAO_ENCONTRADO, deDia, exigirPermissaoAcademico, paraDia } from "./acesso";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const paraBanco = (d: DadosTurma) => ({
  ...d,
  dataInicio: paraDia(d.dataInicio),
  dataFim: paraDia(d.dataFim),
});

async function garantirProduto(tx: Tx, produtoId: string) {
  const produto = await tx.produto.findFirst({ where: { id: produtoId, excluidoEm: null }, select: { id: true } });
  if (!produto) throw new ErroNegocio("Produto não encontrado.");
}

/** Nome único por produto entre turmas não excluídas (sem diferenciar acento e caixa). */
async function garantirNomeLivre(tx: Tx, produtoId: string, nome: string, ignorarId?: string) {
  const turmas = await tx.turma.findMany({
    where: { produtoId, excluidoEm: null, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { nome: true },
  });
  if (turmas.some((t) => nomeBusca(t.nome) === nomeBusca(nome))) throw new ErroNegocio("Este produto já tem uma turma com este nome.");
}

/** Turmas agrupáveis por produto, com as contagens de matrículas. */
export async function listarTurmas(ator: UsuarioAtual) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const turmas = await prisma.turma.findMany({
    where: { excluidoEm: null, produto: { excluidoEm: null } },
    orderBy: [{ produto: { nome: "asc" } }, { ciclica: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      ciclica: true,
      situacao: true,
      dataInicio: true,
      dataFim: true,
      produto: { select: { id: true, nome: true } },
      _count: { select: { matriculas: true } },
      matriculas: { where: { situacao: "ativa" }, select: { id: true } },
    },
  });
  return turmas.map(({ _count, matriculas, dataInicio, dataFim, ...t }) => ({
    ...t,
    dataInicio: deDia(dataInicio),
    dataFim: deDia(dataFim),
    totalMatriculas: _count.matriculas,
    ativos: matriculas.length,
  }));
}
export type TurmaLista = Awaited<ReturnType<typeof listarTurmas>>[number];

/** Opções para os campos de escolha de turma: "Produto · Turma". */
export async function listarOpcoesTurma() {
  const turmas = await prisma.turma.findMany({
    where: { excluidoEm: null, produto: { excluidoEm: null } },
    orderBy: [{ produto: { nome: "asc" } }, { nome: "asc" }],
    select: { id: true, nome: true, produto: { select: { nome: true } } },
  });
  return turmas.map((t) => ({ id: t.id, rotulo: `${t.produto.nome} · ${t.nome}` }));
}

export async function obterTurma(ator: UsuarioAtual, id: string) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const turma = await prisma.turma.findFirst({
    where: { id, excluidoEm: null },
    include: {
      produto: { select: { id: true, nome: true } },
      matriculas: {
        orderBy: { aluno: { nome: "asc" } },
        include: { aluno: { select: { id: true, nome: true } } },
      },
    },
  });
  if (!turma) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return {
    ...turma,
    dataInicio: deDia(turma.dataInicio),
    dataFim: deDia(turma.dataFim),
    matriculas: turma.matriculas.map((m) => ({
      id: m.id,
      situacao: m.situacao,
      dataInicio: deDia(m.dataInicio),
      dataFormatura: deDia(m.dataFormatura),
      vigencia: m.vigencia,
      plano: m.plano,
      observacoes: m.observacoes,
      aluno: m.aluno,
    })),
  };
}
export type TurmaDetalhe = Awaited<ReturnType<typeof obterTurma>>;

export async function criarTurma(ator: UsuarioAtual, dados: DadosTurma) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  return prisma.$transaction(async (tx) => {
    await garantirProduto(tx, dados.produtoId);
    await garantirNomeLivre(tx, dados.produtoId, dados.nome);
    return tx.turma.create({ data: paraBanco(dados), select: { id: true } });
  });
}

export async function editarTurma(ator: UsuarioAtual, id: string, dados: DadosTurma) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  await prisma.$transaction(async (tx) => {
    const atual = await tx.turma.findFirst({ where: { id, excluidoEm: null }, select: { id: true } });
    if (!atual) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    await garantirProduto(tx, dados.produtoId);
    await garantirNomeLivre(tx, dados.produtoId, dados.nome, id);
    await tx.turma.update({ where: { id }, data: paraBanco(dados) });
  });
}

/** Exclusão lógica, só de turma sem matrículas (spec §5, regra 4). */
export async function excluirTurma(ator: UsuarioAtual, id: string) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  await prisma.$transaction(async (tx) => {
    const turma = await tx.turma.findFirst({ where: { id, excluidoEm: null }, select: { _count: { select: { matriculas: true } } } });
    if (!turma) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    if (turma._count.matriculas > 0)
      throw new ErroNegocio("A turma tem matrículas. Mude a situação para Cancelada ou Concluída em vez de excluir.");
    await tx.turma.update({ where: { id }, data: { excluidoEm: new Date() } });
  });
}

/** Troca só a situação, direto da lista (ex.: marcar a turma como concluída). */
export async function definirSituacaoTurma(ator: UsuarioAtual, id: string, situacao: SituacaoTurma) {
  exigirPermissaoAcademico(ator, "academico:gerenciar");
  const { count } = await prisma.turma.updateMany({ where: { id, excluidoEm: null }, data: { situacao } });
  if (count === 0) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
}
