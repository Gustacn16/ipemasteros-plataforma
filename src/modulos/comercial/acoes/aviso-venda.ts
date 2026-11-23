"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { enviarTesteAvisoVenda, salvarAvisoVenda } from "../servicos/aviso-venda";

const esquema = z.object({ url: z.string().max(500).nullable(), ativo: z.boolean() });

export async function salvarAvisoVendaAcao(dados: { url: string | null; ativo: boolean }): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_aviso_venda");
    await salvarAvisoVenda(ator, esquema.parse(dados));
    revalidatePath("/comercial/aviso-venda");
    return { ok: true, mensagem: "Aviso de venda salvo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function testarAvisoVendaAcao(): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_aviso_venda");
    await enviarTesteAvisoVenda(ator);
    return { ok: true, mensagem: "Mensagem de teste enviada ao Make." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
