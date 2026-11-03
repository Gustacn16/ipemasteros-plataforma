import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { contarAtivos } from "../regras/contagem";
import { exigirPermissaoAcademico } from "./acesso";

/** Produtos com turmas, e quantos alunos ativos há em cada turma e produto. */
export async function obterVisaoGeral(ator: UsuarioAtual) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const turmas = await prisma.turma.findMany({
    where: { excluidoEm: null, produto: { excluidoEm: null } },
    orderBy: [{ produto: { nome: "asc" } }, { ciclica: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      situacao: true,
      produto: { select: { id: true, nome: true, tipo: true } },
      matriculas: { select: { alunoId: true, situacao: true } },
    },
  });
  const contagem = contarAtivos(
    turmas.flatMap((t) => t.matriculas.map((m) => ({ alunoId: m.alunoId, situacao: m.situacao, turmaId: t.id, produtoId: t.produto.id }))),
  );

  const produtos = new Map<string, { id: string; nome: string; tipo: string; ativos: number; turmas: { id: string; nome: string; situacao: string; ativos: number; total: number }[] }>();
  for (const t of turmas) {
    const produto = produtos.get(t.produto.id) ?? { ...t.produto, ativos: contagem.porProduto.get(t.produto.id) ?? 0, turmas: [] };
    produto.turmas.push({ id: t.id, nome: t.nome, situacao: t.situacao, ativos: contagem.porTurma.get(t.id) ?? 0, total: t.matriculas.length });
    produtos.set(t.produto.id, produto);
  }
  return { total: contagem.total, produtos: [...produtos.values()].sort((a, b) => b.ativos - a.ativos || a.nome.localeCompare(b.nome)) };
}
