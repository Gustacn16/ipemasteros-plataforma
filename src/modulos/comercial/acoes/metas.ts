"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaMetasProduto } from "../esquemas/meta";
import { mesAnterior, rotuloMes } from "../regras/meta";
import { copiarMetasMesAnterior, salvarMetasProduto } from "../servicos/metas";

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** Salva as metas de um produto no mês (uma linha por vendedor). */
export async function salvarMetasProdutoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_metas");
    const vendedores = formData.getAll("vendedorId").map(texto);
    const valores = formData.getAll("valorAlvo").map(texto);
    const quantidades = formData.getAll("quantidadeAlvo").map(texto);
    const dados = esquemaMetasProduto.parse({
      mes: texto(formData.get("mes")),
      produtoId: texto(formData.get("produtoId")),
      linhas: vendedores.map((vendedorId, i) => ({ vendedorId, valorAlvo: valores[i], quantidadeAlvo: quantidades[i] })),
    });
    await salvarMetasProduto(ator, dados);
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: "Metas salvas." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function copiarMetasAcao(mes: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("comercial:gerenciar_metas");
    const criadas = await copiarMetasMesAnterior(ator, esquemaMetasProduto.shape.mes.parse(mes));
    revalidatePath("/comercial", "layout");
    const origem = rotuloMes(mesAnterior(mes));
    return {
      ok: true,
      mensagem:
        criadas === 0 ? "Nenhuma meta nova para copiar." : `${criadas} ${criadas === 1 ? "meta copiada" : "metas copiadas"} de ${origem}.`,
    };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
