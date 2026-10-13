import "server-only";
import { z } from "zod";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";

/** Estado retornado pelas Server Actions de formulário (usado com useActionState). */
export type EstadoAcao<T = undefined> = {
  ok: boolean;
  mensagem?: string;
  erros?: Record<string, string[] | undefined>;
  dados?: T;
};

export function dadosDoFormulario(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
}

/** Converte erros conhecidos em mensagem para a tela; erros inesperados são relançados. */
export function tratarErroAcao<T>(erro: unknown): EstadoAcao<T> {
  if (erro instanceof z.ZodError) {
    return { ok: false, erros: z.flattenError(erro).fieldErrors as Record<string, string[]> };
  }
  if (erro instanceof ErroNegocio) return { ok: false, mensagem: erro.message };
  if (erro instanceof ErroPermissao) {
    return { ok: false, mensagem: "Você não tem permissão para esta ação." };
  }
  throw erro;
}
