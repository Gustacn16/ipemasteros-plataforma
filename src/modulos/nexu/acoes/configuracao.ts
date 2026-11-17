"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaConfiguracaoIa } from "../esquemas/configuracao";
import { salvarConfiguracao } from "../servicos/configuracao";

export async function salvarConfiguracaoIa(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("nexu:configurar");
    const dados = esquemaConfiguracaoIa.parse(dadosDoFormulario(formData));
    await salvarConfiguracao(ator, dados);
    revalidatePath("/admin/nexu");
    return { ok: true, mensagem: "Configuração salva." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
