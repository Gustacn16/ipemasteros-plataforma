import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { FiltrosRelatorio } from "../esquemas/relatorio";
import {
  baldesDoIntervalo,
  distribuirPorBalde,
  intervaloAnterior,
  intervaloDoPeriodo,
  linhaVazia,
  podio,
  resumirPorPessoa,
  situacaoPrazo,
} from "../regras/relatorio";
import { exigirPermissaoTarefas, filtroEspacosVisiveis, filtroTarefasVisiveis } from "./acesso";

/** Admin e gestor veem a equipe toda; os demais, só a própria linha. */
export function veRelatorioEquipe(ator: UsuarioAtual): boolean {
  return temPermissao(ator.papel, "tarefas:ver_relatorio_equipe");
}

/**
 * Relatório por pessoa (spec F1a, seção 8). Calculado a cada consulta: tarefas
 * abertas agora e tarefas concluídas no período, dentro do que o ator pode ver.
 * Tarefas, listas e espaços excluídos ficam de fora via `filtroTarefasVisiveis`.
 */
export async function obterRelatorio(ator: UsuarioAtual, filtros: FiltrosRelatorio) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  const agora = new Date();
  const intervalo = intervaloDoPeriodo(filtros, agora);
  const anteriorIntervalo = intervaloAnterior(intervalo);
  const equipe = veRelatorioEquipe(ator);

  // Só usuários ativos entram; sem a permissão de equipe, só o próprio ator.
  const filtroResponsavel: Prisma.TarefaResponsavelWhereInput = equipe
    ? { usuario: { ativo: true } }
    : { usuarioId: ator.id };

  const base: Prisma.TarefaWhereInput = {
    AND: [
      filtroTarefasVisiveis(ator),
      filtros.espaco ? { lista: { espacoId: filtros.espaco } } : {},
      { responsaveis: { some: filtroResponsavel } },
    ],
  };
  const selecao = {
    id: true,
    titulo: true,
    dataEntrega: true,
    concluidaEm: true,
    lista: { select: { id: true, nome: true, espaco: { select: { nome: true, cor: true } } } },
    responsaveis: { where: filtroResponsavel, select: { usuario: { select: { id: true, nome: true, imagem: true } } } },
  } satisfies Prisma.TarefaSelect;

  const [abertas, entregues, entreguesAntes, espacos] = await Promise.all([
    prisma.tarefa.findMany({
      where: { AND: [base, { concluidaEm: null }] },
      orderBy: [{ dataEntrega: "asc" }, { criadoEm: "asc" }],
      select: selecao,
    }),
    prisma.tarefa.findMany({
      where: { AND: [base, { concluidaEm: { gte: intervalo.inicio, lt: intervalo.fim } }] },
      orderBy: { concluidaEm: "asc" },
      select: selecao,
    }),
    // Só para a variação dos números do próprio usuário: entregues no período anterior.
    prisma.tarefa.findMany({
      where: { AND: [base, { concluidaEm: { gte: anteriorIntervalo.inicio, lt: anteriorIntervalo.fim } }] },
      select: { dataEntrega: true, concluidaEm: true, responsaveis: selecao.responsaveis },
    }),
    prisma.espaco.findMany({
      where: filtroEspacosVisiveis(ator),
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true },
    }),
  ]);

  const comPessoas = <T extends { responsaveis: { usuario: { id: string; nome: string } }[] }>(t: T) => ({
    ...t,
    responsaveis: t.responsaveis.map((r) => r.usuario),
  });
  const linhas = resumirPorPessoa(abertas.map(comPessoas), entregues.map(comPessoas), agora);
  const minhaLinha = linhas.find((l) => l.pessoa.id === ator.id) ?? linhaVazia({ id: ator.id, nome: ator.nome });

  // Período anterior: abertas não se recalculam (são fotos de agora), só as entregas.
  const linhasAntes = resumirPorPessoa([], entreguesAntes.map(comPessoas), agora);
  const anterior = {
    minhaLinha: linhasAntes.find((l) => l.pessoa.id === ator.id) ?? linhaVazia({ id: ator.id, nome: ator.nome }),
  };

  // Gráfico: mesmo escopo da tabela (já filtrado pelos responsáveis), cada tarefa conta uma vez.
  const serie = distribuirPorBalde(
    entregues.flatMap((t) => (t.concluidaEm ? [{ dataEntrega: t.dataEntrega, concluidaEm: t.concluidaEm }] : [])),
    baldesDoIntervalo(intervalo),
  );

  // Pódio só para quem vê a equipe; a foto vem do próprio select dos responsáveis.
  const fotos = new Map<string, string | null>();
  for (const t of entregues) for (const r of t.responsaveis) fotos.set(r.usuario.id, r.usuario.imagem);
  const podioDoPeriodo = equipe
    ? podio(linhas).map((l) => ({ ...l, foto: fotos.get(l.pessoa.id) ?? null }))
    : [];

  // Detalhe de uma pessoa: as tarefas que entraram na conta dela.
  const idPessoa = filtros.pessoa && (equipe || filtros.pessoa === ator.id) ? filtros.pessoa : null;
  const linhaPessoa = idPessoa ? (linhas.find((l) => l.pessoa.id === idPessoa) ?? null) : null;
  const daPessoa = <T extends { responsaveis: { usuario: { id: string } }[]; dataEntrega: Date | null; concluidaEm: Date | null }>(
    lista: T[],
  ) =>
    lista
      .filter((t) => t.responsaveis.some((r) => r.usuario.id === linhaPessoa?.pessoa.id))
      .map((t) => ({ ...t, situacao: situacaoPrazo(t.dataEntrega, t.concluidaEm, agora) }));
  const detalhe = linhaPessoa
    ? { linha: linhaPessoa, entregues: daPessoa(entregues), abertas: daPessoa(abertas) }
    : null;

  return { intervalo, equipe, espacos, linhas, minhaLinha, anterior, serie, podio: podioDoPeriodo, detalhe };
}
