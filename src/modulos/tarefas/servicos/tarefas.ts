import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { FiltrosLista, Prioridade } from "../esquemas/tarefa";
import { mudancasDaTarefa, type Mudanca } from "../regras/historico";
import { diaDaDataEntrega, diaEmSaoPaulo, grupoDaEntrega, type GrupoMinhas } from "../regras/prazo";
import { ERRO_SUBTAREFAS_ABERTAS, concluidaEmAoMudarStatus } from "../regras/status";
import {
  MENSAGEM_NAO_ENCONTRADO,
  exigirLista,
  exigirPermissaoTarefas,
  exigirTarefa,
  filtroTarefasVisiveis,
  podeEditarTarefa,
  podeExcluirTarefa,
  usuariosAtribuiveis,
} from "./acesso";
import { listarEtiquetas } from "./detalhes";
import { proximaOrdem } from "./ordem";

const selecaoResumo = {
  id: true,
  titulo: true,
  prioridade: true,
  dataEntrega: true,
  concluidaEm: true,
  statusId: true,
  tarefaPaiId: true,
  responsaveis: { select: { usuario: { select: { id: true, nome: true } } } },
  _count: { select: { subtarefas: { where: { excluidoEm: null } } } },
  checklist: { select: { concluido: true } },
  etiquetas: { select: { etiqueta: { select: { id: true, nome: true, cor: true } } } },
} satisfies Prisma.TarefaSelect;

export type TarefaResumo = Prisma.TarefaGetPayload<{ select: typeof selecaoResumo }>;

/** Lista com status e tarefas (subtarefas vêm separadas em `subtarefas`). */
export async function obterListaComTarefas(ator: UsuarioAtual, listaId: string, filtros: FiltrosLista) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  const lista = await exigirLista(ator, listaId);
  const hoje = new Date(`${diaEmSaoPaulo(new Date())}T00:00:00Z`);

  const where: Prisma.TarefaWhereInput = {
    AND: [
      filtroTarefasVisiveis(ator),
      { listaId },
      filtros.responsavel ? { responsaveis: { some: { usuarioId: filtros.responsavel } } } : {},
      filtros.prioridade ? { prioridade: filtros.prioridade } : {},
      filtros.etiqueta ? { etiquetas: { some: { etiquetaId: filtros.etiqueta } } } : {},
      filtros.atrasadas ? { concluidaEm: null, dataEntrega: { lt: hoje } } : {},
    ],
  };

  const [status, tarefas, atribuiveis, etiquetas] = await Promise.all([
    prisma.statusLista.findMany({
      where: { listaId },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true, cor: true, tipo: true },
    }),
    prisma.tarefa.findMany({ where, orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }], select: selecaoResumo }),
    usuariosAtribuiveis(lista.espacoId),
    listarEtiquetas(lista.espacoId),
  ]);

  const principais = tarefas.filter((t) => !t.tarefaPaiId);
  const subtarefas = tarefas.filter((t) => t.tarefaPaiId);
  return { lista, status, principais, subtarefas, atribuiveis, etiquetas };
}

export async function obterTarefa(ator: UsuarioAtual, tarefaId: string) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  await exigirTarefa(ator, tarefaId);
  const tarefa = await prisma.tarefa.findUniqueOrThrow({
    where: { id: tarefaId },
    // Decimal não atravessa para componentes de cliente.
    omit: { ordem: true },
    include: {
      status: { select: { id: true, nome: true, cor: true, tipo: true } },
      lista: { select: { id: true, nome: true, espacoId: true, espaco: { select: { nome: true } } } },
      tarefaPai: { select: { id: true, titulo: true } },
      criadoPor: { select: { nome: true } },
      responsaveis: { select: { usuario: { select: { id: true, nome: true } } } },
      subtarefas: {
        where: { excluidoEm: null },
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: { id: true, titulo: true, concluidaEm: true, status: { select: { nome: true, cor: true } } },
      },
      checklist: { orderBy: { ordem: "asc" }, select: { id: true, texto: true, concluido: true } },
      etiquetas: { select: { etiqueta: { select: { id: true, nome: true, cor: true } } } },
      historico: {
        orderBy: { criadoEm: "desc" },
        take: 100,
        select: { id: true, campo: true, valorAntes: true, valorDepois: true, criadoEm: true, usuario: { select: { nome: true } } },
      },
    },
  });
  const [statusDaLista, atribuiveis, etiquetasDoEspaco] = await Promise.all([
    prisma.statusLista.findMany({
      where: { listaId: tarefa.listaId },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true, cor: true, tipo: true },
    }),
    usuariosAtribuiveis(tarefa.lista.espacoId),
    listarEtiquetas(tarefa.lista.espacoId),
  ]);
  return {
    tarefa,
    statusDaLista,
    atribuiveis,
    etiquetasDoEspaco,
    podeGerenciarEtiquetas: temPermissao(ator.papel, "tarefas:gerenciar_listas") && podeEditarTarefa(ator),
    podeEditar: podeEditarTarefa(ator),
    podeExcluir: podeExcluirTarefa(ator, tarefa),
  };
}

export async function criarTarefa(
  ator: UsuarioAtual,
  dados: { listaId: string; titulo: string; tarefaPaiId?: string },
) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  if (!podeEditarTarefa(ator)) throw new ErroPermissao("tarefas:criar");
  await exigirLista(ator, dados.listaId);

  if (dados.tarefaPaiId) {
    const pai = await exigirTarefa(ator, dados.tarefaPaiId);
    if (pai.tarefaPaiId) throw new ErroNegocio("Subtarefa não pode ter subtarefas.");
    if (pai.listaId !== dados.listaId) throw new ErroNegocio("A subtarefa precisa ficar na lista da tarefa principal.");
  }

  const statusInicial = await prisma.statusLista.findFirst({
    where: { listaId: dados.listaId, tipo: "aberto" },
    orderBy: { ordem: "asc" },
  });
  if (!statusInicial) throw new ErroNegocio("A lista não tem status aberto.");

  const maior = await prisma.tarefa.aggregate({
    _max: { ordem: true },
    where: { listaId: dados.listaId, statusId: statusInicial.id },
  });
  return prisma.tarefa.create({
    data: {
      listaId: dados.listaId,
      tarefaPaiId: dados.tarefaPaiId ?? null,
      titulo: dados.titulo,
      statusId: statusInicial.id,
      ordem: proximaOrdem(maior._max.ordem),
      criadoPorId: ator.id,
    },
  });
}

type CamposTarefa = {
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  dataInicio: Date | null;
  dataEntrega: Date | null;
  responsaveis: string[];
};

export async function atualizarTarefa(ator: UsuarioAtual, tarefaId: string, campos: CamposTarefa) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  if (!podeEditarTarefa(ator)) throw new ErroPermissao("tarefas:editar");
  const tarefa = await exigirTarefa(ator, tarefaId);

  const ids = [...new Set(campos.responsaveis)];
  const atuais = await prisma.tarefaResponsavel.findMany({ where: { tarefaId }, select: { usuarioId: true } });
  const idsAtuais = atuais.map((r) => r.usuarioId);
  // Quem já era responsável pode continuar mesmo se saiu do espaço (regra 7); novos precisam poder ser atribuídos.
  const novos = ids.filter((id) => !idsAtuais.includes(id));
  if (novos.length) {
    const permitidos = new Set((await usuariosAtribuiveis(tarefa.lista.espacoId)).map((u) => u.id));
    if (novos.some((id) => !permitidos.has(id))) {
      throw new ErroNegocio("Só é possível atribuir a membros do espaço.");
    }
  }

  const nomes = new Map(
    (await prisma.usuario.findMany({ where: { id: { in: [...new Set([...ids, ...idsAtuais])] } }, select: { id: true, nome: true } })).map(
      (u) => [u.id, u.nome],
    ),
  );
  const dia = (d: Date | null) => (d ? diaDaDataEntrega(d) : null);
  const mudancas = mudancasDaTarefa(
    { prioridade: tarefa.prioridade, dataInicio: dia(tarefa.dataInicio), dataEntrega: dia(tarefa.dataEntrega), responsaveis: idsAtuais.map((id) => nomes.get(id) ?? "?") },
    { prioridade: campos.prioridade, dataInicio: dia(campos.dataInicio), dataEntrega: dia(campos.dataEntrega), responsaveis: ids.map((id) => nomes.get(id) ?? "?") },
  );

  await prisma.$transaction(async (tx) => {
    await registrarHistorico(tx, tarefaId, ator.id, mudancas);
    await tx.tarefa.update({
      where: { id: tarefaId },
      data: {
        titulo: campos.titulo,
        descricao: campos.descricao,
        prioridade: campos.prioridade,
        dataInicio: campos.dataInicio,
        dataEntrega: campos.dataEntrega,
      },
    });
    await tx.tarefaResponsavel.deleteMany({ where: { tarefaId, usuarioId: { notIn: ids } } });
    await tx.tarefaResponsavel.createMany({ data: novos.map((usuarioId) => ({ tarefaId, usuarioId })) });
  });
}

export async function mudarStatus(
  ator: UsuarioAtual,
  tarefaId: string,
  statusId: string,
  confirmarSubtarefasAbertas = false,
) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  const tarefa = await exigirTarefa(ator, tarefaId);
  const novo = await prisma.statusLista.findFirst({ where: { id: statusId, listaId: tarefa.listaId } });
  if (!novo) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);

  if (novo.tipo === "concluido" && !tarefa.concluidaEm && !confirmarSubtarefasAbertas) {
    const abertas = await prisma.tarefa.count({
      where: { tarefaPaiId: tarefaId, excluidoEm: null, concluidaEm: null },
    });
    if (abertas > 0) throw new ErroNegocio(ERRO_SUBTAREFAS_ABERTAS);
  }

  if (statusId === tarefa.statusId) return;
  const [maior, anterior] = await Promise.all([
    prisma.tarefa.aggregate({ _max: { ordem: true }, where: { listaId: tarefa.listaId, statusId } }),
    prisma.statusLista.findUnique({ where: { id: tarefa.statusId }, select: { nome: true } }),
  ]);
  await prisma.$transaction(async (tx) => {
    await registrarHistorico(tx, tarefaId, ator.id, [{ campo: "status", valorAntes: anterior?.nome ?? null, valorDepois: novo.nome }]);
    await tx.tarefa.update({
      where: { id: tarefaId },
      data: {
        statusId,
        concluidaEm: concluidaEmAoMudarStatus(novo.tipo, tarefa.concluidaEm, new Date()),
        ordem: proximaOrdem(maior._max.ordem),
      },
    });
  });
}

/** Grava as linhas do histórico (regra 8) dentro da transação da mudança. */
async function registrarHistorico(tx: Prisma.TransactionClient, tarefaId: string, usuarioId: string, mudancas: Mudanca[]) {
  if (!mudancas.length) return;
  const json = (v: Mudanca["valorAntes"]) => (v === null ? Prisma.DbNull : v);
  await tx.historicoTarefa.createMany({
    data: mudancas.map((m) => ({ tarefaId, usuarioId, campo: m.campo, valorAntes: json(m.valorAntes), valorDepois: json(m.valorDepois) })),
  });
}

export async function excluirTarefa(ator: UsuarioAtual, tarefaId: string) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  const tarefa = await exigirTarefa(ator, tarefaId);
  if (!podeExcluirTarefa(ator, tarefa)) throw new ErroPermissao("tarefas:excluir");
  const agora = new Date();
  await prisma.$transaction([
    prisma.tarefa.updateMany({ where: { tarefaPaiId: tarefaId, excluidoEm: null }, data: { excluidoEm: agora } }),
    prisma.tarefa.update({ where: { id: tarefaId }, data: { excluidoEm: agora } }),
  ]);
  return { listaId: tarefa.listaId };
}

/** Tarefas abertas do usuário, de todos os espaços, agrupadas por entrega. */
export async function listarMinhasTarefas(ator: UsuarioAtual) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  const tarefas = await prisma.tarefa.findMany({
    where: {
      AND: [filtroTarefasVisiveis(ator), { concluidaEm: null, responsaveis: { some: { usuarioId: ator.id } } }],
    },
    orderBy: [{ dataEntrega: "asc" }, { criadoEm: "asc" }],
    select: {
      id: true,
      titulo: true,
      prioridade: true,
      dataEntrega: true,
      status: { select: { nome: true, cor: true } },
      lista: {
        select: {
          id: true,
          nome: true,
          espaco: { select: { nome: true, cor: true } },
          // Para o botão "Concluir" de quem não abre a lista (professor).
          status: { where: { tipo: "concluido" }, orderBy: { ordem: "asc" }, take: 1, select: { id: true } },
        },
      },
    },
  });
  const agora = new Date();
  const grupos: Record<GrupoMinhas, typeof tarefas> = {
    atrasadas: [],
    hoje: [],
    proximos7: [],
    depois: [],
    sem_data: [],
  };
  for (const t of tarefas) grupos[grupoDaEntrega(t.dataEntrega, agora)].push(t);
  return grupos;
}
