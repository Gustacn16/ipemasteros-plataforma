import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { segredosIguais } from "@/lib/tokens";
import { criarUsuarioComSenha } from "./usuarios";

/** O primeiro acesso só existe enquanto não há nenhum usuário e o token está configurado. */
export function primeiroAcessoConfigurado(): boolean {
  return Boolean(process.env.TOKEN_PRIMEIRO_ACESSO && process.env.TOKEN_PRIMEIRO_ACESSO.length >= 16);
}

export async function criarPrimeiroAdmin(dados: {
  token: string;
  nome: string;
  email: string;
  senha: string;
}) {
  const esperado = process.env.TOKEN_PRIMEIRO_ACESSO;
  if (!primeiroAcessoConfigurado() || !esperado || !segredosIguais(dados.token, esperado)) {
    throw new ErroNegocio("Token de primeiro acesso inválido.");
  }

  return prisma.$transaction(async (tx) => {
    if ((await tx.usuario.count()) > 0) {
      throw new ErroNegocio("O primeiro acesso já foi feito. Entre pelo login.");
    }
    const usuario = await criarUsuarioComSenha(tx, {
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha,
      papel: "admin",
    });
    await registrarAuditoria(
      { usuarioId: usuario.id, acao: "auth.primeiro_acesso", entidade: "usuario", entidadeId: usuario.id },
      tx,
    );
    return { email: usuario.email };
  });
}
