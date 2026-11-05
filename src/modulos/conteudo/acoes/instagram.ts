"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { executarAtualizacao, iniciarAtualizacao } from "../servicos/atualizacao-instagram";
import { definirContaAtiva, ligarContaCanal } from "../servicos/integracao-instagram";
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
