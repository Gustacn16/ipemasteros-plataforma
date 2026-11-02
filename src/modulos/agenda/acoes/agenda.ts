"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissao } from "@/lib/sessao";
import { errosPorCaminho, esquemaEditarEvento, esquemaEvento, esquemaLote, esquemaTipo } from "../esquemas/agenda";
import { adicionarAgenda, editarAgenda, removerAgenda } from "../servicos/agendas-externas";
import { gerarLinkAssinatura } from "../servicos/assinatura";
import { criarEvento, criarLote, editarEvento, excluirEvento } from "../servicos/eventos";
import { criarTipo, definirAtivo, editarTipo, moverTipo } from "../servicos/tipos";

const revalidarAgenda = () => revalidatePath("/agenda", "layout");

const esquemaId = z.string().min(1);
const esquemaMoverTipo = z.object({ tipoId: esquemaId, direcao: z.enum(["cima", "baixo"]) });
const esquemaAtivoTipo = z.object({ tipoId: esquemaId, ativo: z.boolean() });
const esquemaEditarTipo = esquemaTipo.extend({ tipoId: esquemaId });

const esquemaDadosAgenda = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(60, "Nome longo demais"),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
});
const esquemaNovaAgenda = esquemaDadosAgenda.extend({
  url: z.string().trim().min(1, "Cole o endereço iCal").max(2000, "Endereço longo demais"),
});
const esquemaEditarAgenda = esquemaDadosAgenda.extend({ agendaId: esquemaId });

/** Endereço público do ambiente: BETTER_AUTH_URL, ou o host da requisição. */
async function origemDoApp(): Promise<string> {
  const configurada = process.env.BETTER_AUTH_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new ErroNegocio("Não consegui montar o endereço do link.");
  const protocolo = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${protocolo}://${host}`;
}

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
    // O erro de cada período volta como "periodos.<i>", para aparecer na linha.
    if (erro instanceof z.ZodError) return { ok: false, erros: errosPorCaminho(erro) };
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

// ─── Agenda pessoal e assinatura ────────────────────────────────────────────

export async function adicionarAgendaAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("agenda:usar");
    const agenda = await adicionarAgenda(ator, esquemaNovaAgenda.parse(dados));
    revalidarAgenda();
    return { ok: true, mensagem: "Agenda ligada.", dados: agenda };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarAgendaAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:usar");
    const { agendaId, ...campos } = esquemaEditarAgenda.parse(dados);
    await editarAgenda(ator, agendaId, campos);
    revalidarAgenda();
    return { ok: true, mensagem: "Agenda salva." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function removerAgendaAcao(agendaId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("agenda:usar");
    await removerAgenda(ator, esquemaId.parse(agendaId));
    revalidarAgenda();
    return { ok: true, mensagem: "Agenda removida." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

/** O link completo só volta nesta resposta; depois disso o banco guarda apenas o hash. */
export async function gerarLinkAssinaturaAcao(): Promise<EstadoAcao<{ link: string }>> {
  try {
    const ator = await exigirPermissao("agenda:usar");
    const link = await gerarLinkAssinatura(ator, await origemDoApp());
    revalidarAgenda();
    return { ok: true, mensagem: "Link gerado. Copie agora: ele não será mostrado de novo.", dados: { link } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
