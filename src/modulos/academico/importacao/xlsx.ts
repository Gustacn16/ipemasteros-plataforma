import "server-only";
import ExcelJS from "exceljs";
import { ErroNegocio } from "@/lib/erros";
import type { Aba } from "./ler";

/** Fórmula, texto rico e link viram o valor simples que aparece na célula. */
function valorSimples(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== "object") return v;
  if ("result" in v) return valorSimples(v.result as ExcelJS.CellValue);
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return v.text;
  if ("error" in v) return null;
  return null;
}

/** Lê todas as abas de um .xlsx como matrizes de valores (linha 1 = índice 0). */
export async function lerArquivoXlsx(conteudo: ArrayBuffer): Promise<Aba[]> {
  const livro = new ExcelJS.Workbook();
  try {
    await livro.xlsx.load(conteudo);
  } catch {
    throw new ErroNegocio("Não foi possível ler o arquivo. Envie uma planilha .xlsx.");
  }
  return livro.worksheets.map((planilha) => {
    const linhas: unknown[][] = [];
    planilha.eachRow({ includeEmpty: true }, (linha, numero) => {
      const valores = linha.values as ExcelJS.CellValue[];
      // `values` começa no índice 1.
      linhas[numero - 1] = valores.slice(1).map(valorSimples);
    });
    for (let i = 0; i < linhas.length; i++) linhas[i] ??= [];
    return { nome: planilha.name, linhas };
  });
}
