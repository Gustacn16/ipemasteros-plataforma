"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaEditarEvento, esquemaEvento, esquemaLote, esquemaTipo } from "../esquemas/agenda";
import { criarEvento, criarLote, editarEvento, excluirEvento } from "../servicos/eventos";
import { criarTipo, definirAtivo, editarTipo, moverTipo } from "../servicos/tipos";

const revalidarAgenda = () => revalidatePath("/agenda", "layout");

const esquemaId = z.string().min(1);
const esquemaMoverTipo = z.object({ tipoId: esquemaId, direcao: z.enum(["cima", "baixo"]) });
const esquemaAtivoTipo = z.object({ tipoId: esquemaId, ativo: z.boolean() });
const esquemaEditarTipo = esquemaTipo.extend({ tipoId: esquemaId });

export async function criarEventoAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("agenda:editar_institucional");
    const evento = await criarEvento(ator, esquemaEvento.parse(dados));
    revalidarAgenda();
    return { ok: true, mensagem: "Evento criado.", dados: { id: evento.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function criarLoteAcao(dados: unknown): Promise<EstadoAcao<{ quantidade: number }>> {
  try {
    const ator = await exigirPermissao("agenda:editar_institucional");
    const { quantidade } = await criarLote(ator, esquemaLote.parse(dados));
    revalidarAgenda();
    return { ok: true, mensagem: `${quantidade} datas lançadas.`, dados: { quantidade } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarEventoAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:editar_institucional");
    const { eventoId, ...campos } = esquemaEditarEvento.parse(dados);
    await editarEvento(ator, eventoId, campos);
    revalidarAgenda();
    return { ok: true, mensagem: "Evento salvo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirEventoAcao(eventoId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:editar_institucional");
    await excluirEvento(ator, esquemaId.parse(eventoId));
    revalidarAgenda();
    return { ok: true, mensagem: "Evento excluído." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function criarTipoAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("agenda:gerenciar_tipos");
    const tipo = await criarTipo(ator, esquemaTipo.parse(dados));
    revalidarAgenda();
    return { ok: true, mensagem: "Tipo criado.", dados: { id: tipo.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarTipoAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:gerenciar_tipos");
    const { tipoId, ...campos } = esquemaEditarTipo.parse(dados);
    await editarTipo(ator, tipoId, campos);
    revalidarAgenda();
    return { ok: true, mensagem: "Tipo salvo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function moverTipoAcao(dados: { tipoId: string; direcao: "cima" | "baixo" }): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:gerenciar_tipos");
    const d = esquemaMoverTipo.parse(dados);
    await moverTipo(ator, d.tipoId, d.direcao);
    revalidarAgenda();
    return { ok: true };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirTipoAtivoAcao(dados: { tipoId: string; ativo: boolean }): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:gerenciar_tipos");
    const d = esquemaAtivoTipo.parse(dados);
    await definirAtivo(ator, d.tipoId, d.ativo);
    revalidarAgenda();
    return { ok: true };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
