import "server-only";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

// Regras por registro do módulo Comercial (spec Comercial, seção 6). Registro
// fora do alcance responde "não encontrado" para não revelar que existe.

export const MENSAGEM_NAO_ENCONTRADO = "Não encontrado.";

export function exigirPermissaoComercial(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}
