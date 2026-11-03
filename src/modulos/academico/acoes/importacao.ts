"use server";

import { revalidatePath } from "next/cache";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissao } from "@/lib/sessao";
import type { Mapeamento } from "../importacao/planejar";
import { analisarPlanilha, importarPlanilha, type Previa, type ResultadoImportacao } from "../servicos/importacao";

const LIMITE_BYTES = 5 * 1024 * 1024;
/** Prefixo dos campos do mapeamento: `produto:<valor do curso>` → id do produto ou "ignorar". */
const PREFIXO_PRODUTO = "produto:";

async function arquivoDe(formData: FormData): Promise<ArrayBuffer> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroNegocio("Escolha a planilha.");
  if (!arquivo.name.toLowerCase().endsWith(".xlsx")) throw new ErroNegocio("Envie um arquivo .xlsx (Excel).");
  if (arquivo.size > LIMITE_BYTES) throw new ErroNegocio("A planilha passa de 5 MB.");
  return arquivo.arrayBuffer();
}

export async function analisarPlanilhaAcao(_: EstadoAcao<Previa>, formData: FormData): Promise<EstadoAcao<Previa>> {
  try {
    const ator = await exigirPermissao("academico:importar_alunos");
    return { ok: true, dados: await analisarPlanilha(ator, await arquivoDe(formData)) };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function importarPlanilhaAcao(_: EstadoAcao<ResultadoImportacao>, formData: FormData): Promise<EstadoAcao<ResultadoImportacao>> {
  try {
    const ator = await exigirPermissao("academico:importar_alunos");
    const mapeamento: Mapeamento = {};
    for (const [chave, valor] of formData.entries()) {
      if (chave.startsWith(PREFIXO_PRODUTO) && typeof valor === "string" && valor) mapeamento[chave.slice(PREFIXO_PRODUTO.length)] = valor;
    }
    const resultado = await importarPlanilha(ator, await arquivoDe(formData), mapeamento);
    revalidatePath("/academico", "layout");
    return { ok: true, mensagem: "Importação concluída.", dados: resultado };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
