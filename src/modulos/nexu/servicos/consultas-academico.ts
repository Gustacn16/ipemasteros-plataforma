import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { nomeBusca } from "@/modulos/academico/regras/normalizar";
import { exigirPermissaoAcademico } from "@/modulos/academico/servicos/acesso";

/** Alunos pelo nome, só com os campos que o Nexu pode ver (nunca e-mail, telefone, CRM ou observações). */
export async function buscarAlunosParaNexu(ator: UsuarioAtual, nome: string) {
  exigirPermissaoAcademico(ator, "academico:ver");
  const chave = nomeBusca(nome);
  if (!chave) return [];
  return prisma.aluno.findMany({
    where: { nomeBusca: { contains: chave } },
    orderBy: { nome: "asc" },
    take: 20,
    select: {
      id: true,
      nome: true,
      matriculas: {
        where: { turma: { excluidoEm: null } },
        select: { situacao: true, dataInicio: true, dataFormatura: true, turma: { select: { nome: true } } },
      },
    },
  });
}

/** Maior data de formatura entre as matrículas ativas de cada turma (turmaId → "AAAA-MM-DD"). */
export async function formaturasDasTurmas(ator: UsuarioAtual): Promise<Map<string, string>> {
  exigirPermissaoAcademico(ator, "academico:ver");
  const linhas = await prisma.matricula.groupBy({
    by: ["turmaId"],
    where: { situacao: "ativa", dataFormatura: { not: null }, turma: { excluidoEm: null } },
    _max: { dataFormatura: true },
  });
  const mapa = new Map<string, string>();
  for (const l of linhas) if (l._max.dataFormatura) mapa.set(l.turmaId, l._max.dataFormatura.toISOString().slice(0, 10));
  return mapa;
}
