import type { SituacaoMatricula } from "../esquemas/academico";

type MatriculaContada = { alunoId: string; turmaId: string; produtoId: string; situacao: SituacaoMatricula };

/**
 * Alunos ativos (spec Acadêmico 1, §5, regras 1 e 2). Na turma conta cada
 * matrícula ativa; no produto e no total, cada aluno uma vez só.
 */
export function contarAtivos(matriculas: readonly MatriculaContada[]) {
  const porTurma = new Map<string, number>();
  const alunosPorProduto = new Map<string, Set<string>>();
  const todos = new Set<string>();
  for (const m of matriculas) {
    if (m.situacao !== "ativa") continue;
    porTurma.set(m.turmaId, (porTurma.get(m.turmaId) ?? 0) + 1);
    const alunos = alunosPorProduto.get(m.produtoId) ?? new Set<string>();
    alunos.add(m.alunoId);
    alunosPorProduto.set(m.produtoId, alunos);
    todos.add(m.alunoId);
  }
  const porProduto = new Map([...alunosPorProduto].map(([id, alunos]) => [id, alunos.size]));
  return { porTurma, porProduto, total: todos.size };
}
