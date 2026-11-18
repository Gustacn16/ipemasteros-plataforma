"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissao } from "@/lib/sessao";
import { analisarHistorico, importarHistorico, type ResumoImportacao } from "../servicos/importacao-lovable";

// A tela já recorta do arquivo só as tabelas usadas (vendas, metas, produtos e
// vendedores), para caber no limite de 1 MB das Server Actions.
const LIMITE_CARACTERES = 900_000;

async function textoDe(formData: FormData): Promise<string> {
  const conteudo = formData.get("conteudo");
  if (typeof conteudo !== "string" || !conteudo) throw new ErroNegocio("Escolha o arquivo.");
  if (conteudo.length > LIMITE_CARACTERES) throw new ErroNegocio("O arquivo é grande demais.");
  return conteudo;
}

export async function analisarHistoricoAcao(_: EstadoAcao<ResumoImportacao>, formData: FormData): Promise<EstadoAcao<ResumoImportacao>> {
  try {
    const ator = await exigirPermissao("comercial:importar_historico");
    return { ok: true, dados: await analisarHistorico(ator, await textoDe(formData)) };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function importarHistoricoAcao(_: EstadoAcao<ResumoImportacao>, formData: FormData): Promise<EstadoAcao<ResumoImportacao>> {
  try {
    const ator = await exigirPermissao("comercial:importar_historico");
    const resumo = await importarHistorico(ator, await textoDe(formData));
    revalidatePath("/comercial", "layout");
    return { ok: true, mensagem: "Importação concluída.", dados: resumo };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
