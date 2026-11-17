"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { apagarConversa } from "../servicos/conversas";

/** Apaga uma conversa da própria pessoa (exclusão física). */
export async function apagarConversaAcao(conversaId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("nexu:usar");
    await apagarConversa(ator, String(conversaId));
    revalidatePath("/nexu");
    return { ok: true };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
