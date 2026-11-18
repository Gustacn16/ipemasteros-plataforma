"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { booleanoDaAcao, idDaAcao, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { definirContaAtiva, executarImportacao, iniciarImportacao } from "../servicos/importacao-meta";

/**
 * "Atualizar agora": importa os últimos 7 dias (ou o histórico, na primeira vez).
 * A importação roda depois da resposta (`after`), porque a primeira carga pode
 * levar minutos e a conexão com o navegador cairia antes; a tela acompanha sozinha.
 */
export async function atualizarMetaAgoraAcao(): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_integracao_meta");
    const inicio = await iniciarImportacao({ origem: "manual", usuarioId: ator.id });
    revalidatePath("/comercial", "layout");
    if (inicio.status !== "iniciada") return { ok: false, mensagem: inicio.erro ?? "A importação falhou." };
    after(() => executarImportacao(inicio));
    return { ok: true, mensagem: "Importação iniciada. Esta tela se atualiza sozinha." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirContaAtivaAcao(contaId: string, ativa: boolean): Promise<EstadoAcao> {
  try {
    await exigirPermissao("comercial:gerenciar_integracao_meta");
    await definirContaAtiva(idDaAcao(contaId), booleanoDaAcao(ativa));
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: ativa ? "Conta incluída na importação." : "Conta fora da importação." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
