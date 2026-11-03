"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { definirContaAtiva, importarMetaAds } from "../servicos/importacao-meta";

/** "Atualizar agora": importa os últimos 7 dias (ou o histórico, na primeira vez). */
export async function atualizarMetaAgoraAcao(): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_integracao_meta");
    const r = await importarMetaAds({ origem: "manual", usuarioId: ator.id });
    revalidatePath("/comercial", "layout");
    if (r.status === "recusada") return { ok: false, mensagem: r.erro };
    if (r.status === "falhou") return { ok: false, mensagem: r.erro ?? "A importação falhou." };
    return { ok: true, mensagem: `Importação concluída: ${r.registros} ${r.registros === 1 ? "registro" : "registros"}.` };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirContaAtivaAcao(contaId: string, ativa: boolean): Promise<EstadoAcao> {
  try {
    await exigirPermissao("comercial:gerenciar_integracao_meta");
    await definirContaAtiva(contaId, ativa);
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: ativa ? "Conta incluída na importação." : "Conta fora da importação." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
