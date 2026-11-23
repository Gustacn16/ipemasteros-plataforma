import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { acharAlunoDaVenda } from "../regras/aluno-da-venda";
import { nomeBusca } from "../regras/normalizar";
import { paraDia } from "./acesso";

// Ponte Comercial → Acadêmico: a venda com turma matricula o aluno.
// Funções internas: a permissão é a de registrar venda, conferida pelo Comercial,
// e tudo roda dentro da transação da venda. Nada de nome ou telefone na auditoria.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const TURMA_ABERTA = {
  excluidoEm: null,
  situacao: { in: ["planejada", "em_andamento"] },
  produto: { excluidoEm: null },
} satisfies Prisma.TurmaWhereInput;

/** Turmas abertas de cada produto, para o campo Turma do formulário de venda. */
export async function turmasAbertasPorProduto() {
  const turmas = await prisma.turma.findMany({
    where: TURMA_ABERTA,
    orderBy: [{ ciclica: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, produtoId: true },
  });
  const porProduto = new Map<string, { id: string; nome: string }[]>();
  for (const t of turmas) porProduto.set(t.produtoId, [...(porProduto.get(t.produtoId) ?? []), { id: t.id, nome: t.nome }]);
  return porProduto;
}

/** Turma obrigatória ao criar (se o produto tem turma aberta) e sempre do próprio produto. */
export async function exigirTurmaDaVenda(
  tx: Tx,
  produtoId: string,
  turmaId: string | null,
  opcoes: { criando: boolean; turmaAtualId: string | null },
) {
  if (!turmaId) {
    if (opcoes.criando && (await tx.turma.count({ where: { ...TURMA_ABERTA, produtoId } })) > 0) {
      throw new ErroNegocio("Escolha a turma do aluno.");
    }
    return;
  }
  if (turmaId === opcoes.turmaAtualId) return;
  const turma = await tx.turma.findFirst({ where: { ...TURMA_ABERTA, id: turmaId, produtoId }, select: { id: true } });
  if (!turma) throw new ErroNegocio("Turma indisponível para este produto.");
}

/** Acha ou cria o aluno e o matricula na turma; se já está nela, não faz nada. */
export async function lancarAlunoDaVenda(
  tx: Tx,
  usuarioId: string,
  v: { vendaId: string; turmaId: string; nome: string; whatsapp: string | null; dataVenda: string },
) {
  const busca = nomeBusca(v.nome);
  const candidatos = await tx.aluno.findMany({ select: { id: true, nomeBusca: true, telefone: true } });
  let alunoId = acharAlunoDaVenda(candidatos, { nomeBusca: busca, whatsapp: v.whatsapp })?.id;
  if (alunoId) {
    const ja = await tx.matricula.findUnique({ where: { alunoId_turmaId: { alunoId, turmaId: v.turmaId } }, select: { id: true } });
    if (ja) return;
  } else {
    const aluno = await tx.aluno.create({ data: { nome: v.nome, nomeBusca: busca, telefone: v.whatsapp }, select: { id: true } });
    alunoId = aluno.id;
    await registrarAuditoria({ usuarioId, acao: "aluno.criado", entidade: "Aluno", entidadeId: alunoId, diff: { origem: "venda" } }, tx);
  }
  const matricula = await tx.matricula.create({
    data: { alunoId, turmaId: v.turmaId, situacao: "ativa", dataInicio: paraDia(v.dataVenda), vendaId: v.vendaId },
    select: { id: true },
  });
  await registrarAuditoria(
    { usuarioId, acao: "matricula.criada", entidade: "Matricula", entidadeId: matricula.id, diff: { origem: "venda" } },
    tx,
  );
}

/** Leva a matrícula criada pela venda para outra turma. */
export async function moverMatriculaDaVenda(tx: Tx, usuarioId: string, vendaId: string, turmaId: string) {
  const matricula = await tx.matricula.findUnique({ where: { vendaId }, select: { id: true, alunoId: true, turmaId: true } });
  if (!matricula) return "sem_matricula" as const;
  if (matricula.turmaId === turmaId) return "movida" as const;
  const ocupada = await tx.matricula.findUnique({ where: { alunoId_turmaId: { alunoId: matricula.alunoId, turmaId } }, select: { id: true } });
  if (ocupada) throw new ErroNegocio("O aluno já está nessa turma.");
  await tx.matricula.update({ where: { id: matricula.id }, data: { turmaId } });
  await registrarAuditoria(
    { usuarioId, acao: "matricula.editada", entidade: "Matricula", entidadeId: matricula.id, diff: { origem: "venda", campos: ["turmaId"] } },
    tx,
  );
  return "movida" as const;
}

/** Venda excluída: a matrícula que ela criou fica cancelada, com nota. */
export async function cancelarMatriculaDaVenda(tx: Tx, usuarioId: string, vendaId: string) {
  const matricula = await tx.matricula.findUnique({ where: { vendaId }, select: { id: true, observacoes: true } });
  if (!matricula) return;
  await tx.matricula.update({
    where: { id: matricula.id },
    data: { situacao: "cancelada", observacoes: [matricula.observacoes, "Venda excluída."].filter(Boolean).join("\n") },
  });
  await registrarAuditoria(
    { usuarioId, acao: "matricula.editada", entidade: "Matricula", entidadeId: matricula.id, diff: { origem: "venda", campos: ["situacao"] } },
    tx,
  );
}
