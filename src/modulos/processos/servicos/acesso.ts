import "server-only";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

export const MENSAGEM_NAO_ENCONTRADO = "Documento não encontrado.";

export function exigir(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}

export const podeEditar = (ator: UsuarioAtual) => temPermissao(ator.papel, "processos:editar");

