"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, idDaAcao, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import {
  esquemaEditarEspaco,
  esquemaEspaco,
  esquemaExcluirStatus,
  esquemaLista,
  esquemaMembros,
  esquemaRenomearLista,
  esquemaStatusLista,
} from "../esquemas/estrutura";
import { criarEspaco, definirMembros, editarEspaco, excluirEspaco } from "../servicos/espacos";
import { criarLista, excluirLista, excluirStatus, renomearLista, salvarStatus } from "../servicos/listas";

// A barra lateral mostra a árvore de espaços em todas as páginas.
const revalidarTudo = () => revalidatePath("/", "layout");

export async function criarEspacoAcao(_: EstadoAcao<{ id: string }>, formData: FormData): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_espacos");
    const espaco = await criarEspaco(ator, esquemaEspaco.parse(dadosDoFormulario(formData)));
    revalidarTudo();
    return { ok: true, mensagem: "Espaço criado.", dados: { id: espaco.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarEspacoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_espacos");
    const { espacoId, ...dados } = esquemaEditarEspaco.parse(dadosDoFormulario(formData));
    await editarEspaco(ator, espacoId, dados);
    revalidarTudo();
    return { ok: true, mensagem: "Espaço atualizado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirEspacoAcao(espacoId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_espacos");
    await excluirEspaco(ator, idDaAcao(espacoId));
    revalidarTudo();
    return { ok: true, mensagem: "Espaço excluído." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirMembrosAcao(espacoId: string, usuarioIds: string[]): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_espacos");
    const dados = esquemaMembros.parse({ espacoId, usuarioIds });
    await definirMembros(ator, dados.espacoId, dados.usuarioIds);
    revalidarTudo();
    return { ok: true, mensagem: "Membros atualizados." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function criarListaAcao(_: EstadoAcao<{ id: string }>, formData: FormData): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_listas");
    const lista = await criarLista(ator, esquemaLista.parse(dadosDoFormulario(formData)));
    revalidarTudo();
    return { ok: true, mensagem: "Lista criada.", dados: { id: lista.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function renomearListaAcao(listaId: string, nome: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_listas");
    const dados = esquemaRenomearLista.parse({ listaId, nome });
    await renomearLista(ator, dados.listaId, dados.nome);
    revalidarTudo();
    return { ok: true, mensagem: "Lista renomeada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirListaAcao(listaId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_listas");
    await excluirLista(ator, idDaAcao(listaId));
    revalidarTudo();
    return { ok: true, mensagem: "Lista excluída." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function salvarStatusAcao(listaId: string, status: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_listas");
    const dados = esquemaStatusLista.parse({ listaId, status });
    await salvarStatus(ator, dados.listaId, dados.status);
    revalidatePath(`/tarefas/listas/${dados.listaId}`);
    return { ok: true, mensagem: "Status salvos." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirStatusAcao(statusId: string, destinoId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("tarefas:gerenciar_listas");
    const dados = esquemaExcluirStatus.parse({ statusId, destinoId });
    await excluirStatus(ator, dados.statusId, dados.destinoId);
    revalidatePath("/tarefas", "layout");
    return { ok: true, mensagem: "Status excluído." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
