import "server-only";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

export function exigir(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}
