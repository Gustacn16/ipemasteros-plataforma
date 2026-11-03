import "server-only";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

export const MENSAGEM_NAO_ENCONTRADO = "Não encontrado.";

export function exigirPermissaoAcademico(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}

/** "aaaa-mm-dd" → Date à meia-noite UTC (coluna DATE); e o caminho de volta. */
export const paraDia = (d: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null);
export const deDia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Campos que mudaram, para a auditoria: só os nomes, nunca os valores pessoais. */
export function camposAlterados(antes: Record<string, unknown>, depois: Record<string, unknown>): string[] {
  return Object.keys(depois).filter((k) => {
    const a = antes[k];
    const b = depois[k];
    return (a instanceof Date ? deDia(a) : (a ?? null)) !== (b instanceof Date ? deDia(b) : (b ?? null));
  });
}
