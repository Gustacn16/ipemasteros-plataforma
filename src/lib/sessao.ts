import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { ErroPermissao, temPermissao, type Papel, type Permissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

/** O que a aplicação sabe do usuário logado. Só campos não sensíveis. */
export type UsuarioAtual = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** URL da foto de perfil (rota protegida), se houver. */
  imagem: string | null;
  /** Falso enquanto a pessoa não preencheu dados básicos e foto. */
  perfilCompleto: boolean;
};

/**
 * Usuário da requisição atual, ou null. Relê papel/ativo do banco a cada
 * requisição para que mudança de papel e desativação valham na hora.
 */
export const obterUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.user.id },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, imagem: true, perfilCompletoEm: true },
  });
  if (!usuario?.ativo) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    imagem: usuario.imagem,
    perfilCompleto: usuario.perfilCompletoEm !== null,
  };
});

/** Para páginas: redireciona ao login se não houver sessão, e ao cadastro se faltar perfil e foto. */
export async function exigirUsuario(): Promise<UsuarioAtual> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.perfilCompleto) redirect("/completar-cadastro");
  return usuario;
}

/** Para páginas: 404 implícito via redirect se faltar permissão. */
export async function exigirPermissaoPagina(permissao: Permissao): Promise<UsuarioAtual> {
  const usuario = await exigirUsuario();
  if (!temPermissao(usuario.papel, permissao)) redirect("/inicio?erro=sem-permissao");
  return usuario;
}

/** Para Server Actions e Route Handlers: lança erro se faltar sessão ou permissão. */
export async function exigirPermissao(permissao: Permissao): Promise<UsuarioAtual> {
  const usuario = await obterUsuarioAtual();
  if (!usuario || !temPermissao(usuario.papel, permissao)) throw new ErroPermissao(permissao);
  return usuario;
}
