"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaAtualizarTarefa, esquemaMudarStatus, esquemaNovaTarefa } from "../esquemas/tarefa";
import { atualizarTarefa, criarTarefa, excluirTarefa, mudarStatus } from "../servicos/tarefas";

const revalidarTarefas = () => revalidatePath("/tarefas", "layout");

export async function criarTarefaAcao(dados: {
  listaId: string;
  titulo: string;
  tarefaPaiId?: string;
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
