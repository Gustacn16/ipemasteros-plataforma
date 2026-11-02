"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaCanal } from "../esquemas/produto";
import { definirAtivoCanal, salvarCanal } from "../servicos/canais";

export async function salvarCanalAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    const id = formData.get("id");
    const dados = esquemaCanal.parse(dadosDoFormulario(formData));
    await salvarCanal(ator, { ...dados, id: typeof id === "string" && id ? id : undefined });
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: "Canal salvo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirAtivoCanalAcao(id: string, ativo: boolean): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    await definirAtivoCanal(ator, id, ativo);
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: ativo ? "Canal ativado." : "Canal desativado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
