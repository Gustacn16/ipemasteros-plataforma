import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { Pessoa } from "../regras/aniversarios";
import { deDia, exigirPermissaoAcademico } from "./acesso";

/** Alunos com matrícula ativa e professores ativos que têm data de nascimento. */
export async function listarPessoasComNascimento(ator: UsuarioAtual): Promise<Pessoa[]> {
  exigirPermissaoAcademico(ator, "academico:ver");
  const select = { id: true, nome: true, telefone: true, dataNascimento: true } as const;
  const [alunos, professores] = await Promise.all([
    prisma.aluno.findMany({
      where: { dataNascimento: { not: null }, matriculas: { some: { situacao: "ativa", turma: { excluidoEm: null } } } },
      select,
    }),
    prisma.professor.findMany({ where: { ativo: true, dataNascimento: { not: null } }, select }),
  ]);
  const pessoa = (tipo: Pessoa["tipo"]) => (p: (typeof alunos)[number]): Pessoa => ({
    id: p.id,
    nome: p.nome,
    tipo,
    telefone: p.telefone,
    dataNascimento: deDia(p.dataNascimento)!,
  });
  return [...alunos.map(pessoa("aluno")), ...professores.map(pessoa("professor"))];
}
