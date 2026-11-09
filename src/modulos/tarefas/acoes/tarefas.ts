"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import {
  esquemaAtualizarItemChecklist,
  esquemaAtualizarTarefa,
  esquemaEditarEtiqueta,
  esquemaEtiquetasTarefa,
  esquemaMoverItemChecklist,
  esquemaMudarStatus,
  esquemaNovaEtiqueta,
  esquemaNovaTarefa,
  esquemaNovoItemChecklist,
} from "../esquemas/tarefa";
import {
  adicionarItemChecklist,
  atualizarItemChecklist,
  criarEtiqueta,
  definirEtiquetasTarefa,
  editarEtiqueta,
  excluirEtiqueta,
  moverItemChecklist,
  removerItemChecklist,
} from "../servicos/detalhes";
import { atualizarTarefa, criarTarefa, excluirTarefa, mudarStatus } from "../servicos/tarefas";

const revalidarTarefas = () => revalidatePath("/tarefas", "layout");

export async function criarTarefaAcao(dados: {
  listaId: string;
  titulo: string;
  tarefaPaiId?: string;
  subtarefas?: string[];
}): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("tarefas:usar");
    const tarefa = await criarTarefa(ator, esquemaNovaTarefa.parse(dados));
    revalidarTarefas();
    return { ok: true, dados: { id: tarefa.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function atualizarTarefaAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:usar");
    const { tarefaId, ...campos } = esquemaAtualizarTarefa.parse(dados);
    await atualizarTarefa(ator, tarefaId, campos);
    revalidarTarefas();
    return { ok: true, mensagem: "Tarefa salva." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function mudarStatusAcao(dados: {
  tarefaId: string;
  statusId: string;
  confirmarSubtarefasAbertas?: boolean;
}): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:usar");
    const d = esquemaMudarStatus.parse(dados);
    await mudarStatus(ator, d.tarefaId, d.statusId, d.confirmarSubtarefasAbertas);
    revalidarTarefas();
    return { ok: true };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirTarefaAcao(tarefaId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:usar");
    await excluirTarefa(ator, tarefaId);
    revalidarTarefas();
    return { ok: true, mensagem: "Tarefa excluída." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

/** Executa uma ação do módulo: permissão, serviço, revalidação e erro padronizado. */
async function executar(fn: (ator: Awaited<ReturnType<typeof exigirPermissao>>) => Promise<unknown>, mensagem?: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:usar");
    await fn(ator);
    revalidarTarefas();
    return { ok: true, mensagem };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function adicionarItemChecklistAcao(dados: { tarefaId: string; texto: string }) {
  return executar((ator) => {
    const d = esquemaNovoItemChecklist.parse(dados);
    return adicionarItemChecklist(ator, d.tarefaId, d.texto);
  });
}

export async function atualizarItemChecklistAcao(dados: { itemId: string; texto?: string; concluido?: boolean }) {
  return executar((ator) => {
    const { itemId, ...campos } = esquemaAtualizarItemChecklist.parse(dados);
    return atualizarItemChecklist(ator, itemId, campos);
  });
}

export async function moverItemChecklistAcao(dados: { itemId: string; direcao: "cima" | "baixo" }) {
  return executar((ator) => {
    const d = esquemaMoverItemChecklist.parse(dados);
    return moverItemChecklist(ator, d.itemId, d.direcao);
  });
}

export async function removerItemChecklistAcao(itemId: string) {
  return executar((ator) => removerItemChecklist(ator, esquemaMoverItemChecklist.shape.itemId.parse(itemId)));
}

export async function definirEtiquetasTarefaAcao(dados: { tarefaId: string; etiquetaIds: string[] }) {
  return executar((ator) => {
    const d = esquemaEtiquetasTarefa.parse(dados);
    return definirEtiquetasTarefa(ator, d.tarefaId, d.etiquetaIds);
  });
}

export async function criarEtiquetaAcao(dados: { espacoId: string; nome: string; cor: string }): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_listas");
    const etiqueta = await criarEtiqueta(ator, esquemaNovaEtiqueta.parse(dados));
    revalidarTarefas();
    return { ok: true, mensagem: "Etiqueta criada.", dados: { id: etiqueta.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarEtiquetaAcao(dados: { etiquetaId: string; nome: string; cor: string }) {
  return executar((ator) => editarEtiqueta(ator, esquemaEditarEtiqueta.parse(dados)), "Etiqueta salva.");
}

export async function excluirEtiquetaAcao(etiquetaId: string) {
  return executar((ator) => excluirEtiqueta(ator, esquemaEditarEtiqueta.shape.etiquetaId.parse(etiquetaId)), "Etiqueta excluída.");
}
