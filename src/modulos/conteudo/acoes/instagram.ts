"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { executarAtualizacao, iniciarAtualizacao } from "../servicos/atualizacao-instagram";
import { definirContaAtiva, ligarContaCanal } from "../servicos/integracao-instagram";
import { candidatasParaLigar, desligarMidia, ligarMidia } from "../servicos/ligacao-instagram";
import { repositorioPrisma } from "../servicos/repositorio-instagram";

/**
 * "Atualizar agora": atualização completa, refazendo os números de todos os posts.
 * Roda depois da resposta (`after`), porque a primeira carga pode levar minutos; a tela acompanha sozinha.
 */
export async function atualizarInstagramAgoraAcao(): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("conteudo:gerenciar_integracao_instagram");
    const inicio = await iniciarAtualizacao({ tipo: "completa", origem: "manual", usuarioId: ator.id, repo: repositorioPrisma });
    revalidatePath("/conteudo", "layout");
    if (inicio.status !== "iniciada") return { ok: false, mensagem: inicio.erro ?? "A atualização falhou." };
    after(() => executarAtualizacao({ ...inicio, repo: repositorioPrisma }));
    return { ok: true, mensagem: "Atualização iniciada. Esta tela se atualiza sozinha." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

const esquemaLigarConta = z.object({ contaId: z.string().min(1), canalId: z.string().min(1).nullable() });

export async function ligarContaCanalAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("conteudo:gerenciar_integracao_instagram");
    const { contaId, canalId } = esquemaLigarConta.parse(dados);
    await ligarContaCanal(ator, contaId, canalId);
    revalidatePath("/conteudo", "layout");
    return { ok: true, mensagem: canalId ? "Conta ligada ao canal." : "Conta desligada do canal." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirContaInstagramAtivaAcao(contaId: string, ativa: boolean): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("conteudo:gerenciar_integracao_instagram");
    await definirContaAtiva(ator, z.string().min(1).parse(contaId), ativa === true);
    revalidatePath("/conteudo", "layout");
    return { ok: true, mensagem: ativa ? "Conta incluída na atualização." : "Conta fora da atualização." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

const id = z.string().min(1).max(40);
const esquemaLigarMidia = z.object({ midiaId: id, publicacaoId: id });

/** Lista para o diálogo "Ligar a um conteúdo". */
export async function candidatasParaLigarAcao(midiaId: string): Promise<EstadoAcao<Awaited<ReturnType<typeof candidatasParaLigar>>>> {
  try {
    const ator = await exigirPermissao("conteudo:usar");
    return { ok: true, dados: await candidatasParaLigar(ator, id.parse(midiaId)) };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function ligarMidiaAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("conteudo:usar");
    const { midiaId, publicacaoId } = esquemaLigarMidia.parse(dados);
    await ligarMidia(ator, midiaId, publicacaoId);
    revalidatePath("/conteudo", "layout");
    return { ok: true, mensagem: "Post ligado ao conteúdo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function desligarMidiaAcao(midiaId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("conteudo:usar");
    await desligarMidia(ator, id.parse(midiaId));
    revalidatePath("/conteudo", "layout");
    return { ok: true, mensagem: "Post desligado. Os números passam a ser editáveis." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
