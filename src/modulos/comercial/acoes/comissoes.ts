"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaComissoesProdutos } from "../esquemas/produto";
import { salvarComissoesProdutos } from "../servicos/comissoes";

/** Salva a tabela "Comissão por produto". */
export async function salvarComissoesAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    await salvarComissoesProdutos(ator, esquemaComissoesProdutos.parse(dados));
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: "Comissões salvas." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
