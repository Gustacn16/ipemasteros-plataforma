"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { salvarTipoParaAvisos } from "../servicos/avisos-config";

export async function salvarTipoParaAvisosAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("whatsapp:avisos");
    await salvarTipoParaAvisos(ator, dados);
    revalidatePath("/whatsapp/configuracoes");
    return { ok: true, mensagem: "Configuração salva." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
