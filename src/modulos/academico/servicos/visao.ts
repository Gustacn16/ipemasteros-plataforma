import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { SituacaoMatricula, SituacaoTurma } from "../esquemas/academico";
import { contarAtivos } from "../regras/contagem";
import { exigirPermissaoAcademico } from "./acesso";

type TurmaVisao = { id: string; nome: string; situacao: SituacaoTurma; ativos: number; total: number };
type ProdutoVisao = {
  id: string;
  nome: string;
  tipo: string;
  ativos: number;
  /** Matrículas do produto por situação. */
  situacoes: Record<SituacaoMatricula, number>;
  turmas: TurmaVisao[];
};

/** Produtos com turmas, quantos alunos ativos há em cada um, e o total da base. */
export async function obterVisaoGeral(ator: UsuarioAtual) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const [turmas, totalAlunos] = await Promise.all([
    prisma.turma.findMany({
      where: { excluidoEm: null, produto: { excluidoEm: null } },
      orderBy: [{ produto: { nome: "asc" } }, { ciclica: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        situacao: true,
        produto: { select: { id: true, nome: true, tipo: true } },
        matriculas: { select: { alunoId: true, situacao: true } },
      },
    }),
    prisma.aluno.count(),
  ]);
  const contagem = contarAtivos(
    turmas.flatMap((t) => t.matriculas.map((m) => ({ alunoId: m.alunoId, situacao: m.situacao, turmaId: t.id, produtoId: t.produto.id }))),
  );

  const produtos = new Map<string, ProdutoVisao>();
  for (const t of turmas) {
    const produto = produtos.get(t.produto.id) ?? {
      ...t.produto,
      ativos: contagem.porProduto.get(t.produto.id) ?? 0,
      situacoes: { ativa: 0, trancada: 0, concluida: 0, cancelada: 0 },
      turmas: [],
    };
    for (const m of t.matriculas) produto.situacoes[m.situacao]++;
    produto.turmas.push({ id: t.id, nome: t.nome, situacao: t.situacao, ativos: contagem.porTurma.get(t.id) ?? 0, total: t.matriculas.length });
    produtos.set(t.produto.id, produto);
  }
  return {
    ativos: contagem.total,
    totalAlunos,
    produtos: [...produtos.values()].sort((a, b) => b.ativos - a.ativos || a.nome.localeCompare(b.nome)),
  };
}
