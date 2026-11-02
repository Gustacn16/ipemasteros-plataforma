"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaLink, esquemaOferta, esquemaProduto } from "../esquemas/produto";
import {
  criarProduto,
  definirAtivoProduto,
  editarProduto,
  excluirLink,
  excluirOferta,
  excluirProduto,
  salvarLink,
  salvarOferta,
} from "../servicos/produtos";

const revalidarComercial = () => revalidatePath("/comercial", "layout");

/** Id opcional vindo de campo oculto. */
const idDe = (formData: FormData) => {
  const id = formData.get("id");
  return typeof id === "string" && id ? id : undefined;
};

const produtoIdDe = (formData: FormData) => {
  const id = formData.get("produtoId");
  return typeof id === "string" ? id : "";
};

export async function criarProdutoAcao(_: EstadoAcao<{ id: string }>, formData: FormData): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    const produto = await criarProduto(ator, esquemaProduto.parse(dadosDoFormulario(formData)));
    revalidarComercial();
    return { ok: true, mensagem: "Produto criado.", dados: { id: produto.id } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function editarProdutoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    await editarProduto(ator, idDe(formData) ?? "", esquemaProduto.parse(dadosDoFormulario(formData)));
    revalidarComercial();
    return { ok: true, mensagem: "Produto atualizado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirAtivoProdutoAcao(id: string, ativo: boolean): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    await definirAtivoProduto(ator, id, ativo);
    revalidarComercial();
    return {
      ok: true,
      mensagem: ativo ? "Produto ativado." : "Produto desativado.",
    };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirProdutoAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:excluir_produtos");
    await excluirProduto(ator, id);
    revalidarComercial();
    return { ok: true, mensagem: "Produto excluído." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function salvarOfertaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    // Caixas marcadas repetem o nome do campo; dadosDoFormulario guardaria só a última.
    const dados = esquemaOferta.parse({
      ...dadosDoFormulario(formData),
      formasPagamento: formData.getAll("formasPagamento"),
    });
    await salvarOferta(ator, produtoIdDe(formData), {
      ...dados,
      id: idDe(formData),
    });
    revalidarComercial();
    return { ok: true, mensagem: "Oferta salva." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirOfertaAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    await excluirOferta(ator, id);
    revalidarComercial();
    return { ok: true, mensagem: "Oferta excluída." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function salvarLinkAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    const dados = esquemaLink.parse(dadosDoFormulario(formData));
    await salvarLink(ator, produtoIdDe(formData), {
      ...dados,
      id: idDe(formData),
    });
    revalidarComercial();
    return { ok: true, mensagem: "Link salvo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirLinkAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_produtos");
    await excluirLink(ator, id);
    revalidarComercial();
    return { ok: true, mensagem: "Link excluído." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
