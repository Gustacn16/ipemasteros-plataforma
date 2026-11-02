"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaVenda } from "../esquemas/venda";
import { criarVenda, editarVenda, excluirVenda } from "../servicos/vendas";

const revalidarComercial = () => revalidatePath("/comercial", "layout");

/** Cria a venda (sem `id`) ou edita a existente (com `id`). */
export async function salvarVendaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:registrar_venda");
    const { id, ...campos } = dadosDoFormulario(formData);
    const dados = esquemaVenda.parse(campos);
    if (id) await editarVenda(ator, id, dados);
    else await criarVenda(ator, dados);
    revalidarComercial();
    return { ok: true, mensagem: id ? "Venda atualizada." : "Venda registrada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirVendaAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:registrar_venda");
    await excluirVenda(ator, id);
    revalidarComercial();
    return { ok: true, mensagem: "Venda excluída." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
