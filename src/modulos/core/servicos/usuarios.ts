import "server-only";
import { hashPassword } from "better-auth/crypto";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao, type Papel } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";

export async function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      ativo: true,
      ultimoAcessoEm: true,
      criadoEm: true,
    },
  });
}

export async function existeAlgumUsuario(): Promise<boolean> {
  return (await prisma.usuario.count()) > 0;
}

type NovoUsuario = { nome: string; email: string; senha: string; papel: Papel };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Cria usuário + credencial de senha (formato do Better Auth). Uso interno. */
export async function criarUsuarioComSenha(tx: Tx, dados: NovoUsuario) {
  const existente = await tx.usuario.findUnique({ where: { email: dados.email } });
  if (existente) throw new ErroNegocio("Já existe um usuário com este e-mail.");

  const usuario = await tx.usuario.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      papel: dados.papel,
      // O e-mail foi comprovado pelo link do convite.
      emailVerificado: true,
    },
  });
  await tx.conta.create({
    data: {
      usuarioId: usuario.id,
      accountId: usuario.id,
      providerId: "credential",
      password: await hashPassword(dados.senha),
    },
  });
  return usuario;
}

/** Garante que a operação não deixa o sistema sem nenhum admin ativo. */
async function garantirOutroAdminAtivo(tx: Tx, usuarioId: string) {
  const outrosAdmins = await tx.usuario.count({
    where: { papel: "admin", ativo: true, id: { not: usuarioId } },
  });
  if (outrosAdmins === 0) {
    throw new ErroNegocio("Não é possível: este é o último admin ativo do sistema.");
  }
}

export async function alterarPapel(ator: UsuarioAtual, usuarioId: string, novoPapel: Papel) {
  if (!temPermissao(ator.papel, "core:alterar_papel")) throw new ErroPermissao("core:alterar_papel");
  if (ator.id === usuarioId) throw new ErroNegocio("Você não pode alterar o seu próprio papel.");

  await prisma.$transaction(async (tx) => {
    const alvo = await tx.usuario.findUnique({ where: { id: usuarioId } });
    if (!alvo) throw new ErroNegocio("Usuário não encontrado.");
    if (alvo.papel === novoPapel) return;
    if (alvo.papel === "admin") await garantirOutroAdminAtivo(tx, usuarioId);

    await tx.usuario.update({ where: { id: usuarioId }, data: { papel: novoPapel } });
    // Mudança de papel vale na hora: derruba as sessões abertas.
    await tx.sessao.deleteMany({ where: { usuarioId } });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "usuario.papel_alterado",
        entidade: "usuario",
        entidadeId: usuarioId,
        diff: { antes: { papel: alvo.papel }, depois: { papel: novoPapel } },
      },
      tx,
    );
  });
}

export async function definirAtivo(ator: UsuarioAtual, usuarioId: string, ativo: boolean) {
  if (!temPermissao(ator.papel, "core:desativar_usuario")) {
    throw new ErroPermissao("core:desativar_usuario");
  }
  if (ator.id === usuarioId) throw new ErroNegocio("Você não pode desativar a sua própria conta.");

  await prisma.$transaction(async (tx) => {
    const alvo = await tx.usuario.findUnique({ where: { id: usuarioId } });
    if (!alvo) throw new ErroNegocio("Usuário não encontrado.");
    if (alvo.ativo === ativo) return;
    if (!ativo && alvo.papel === "admin") await garantirOutroAdminAtivo(tx, usuarioId);

    await tx.usuario.update({ where: { id: usuarioId }, data: { ativo } });
    if (!ativo) await tx.sessao.deleteMany({ where: { usuarioId } });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: ativo ? "usuario.reativado" : "usuario.desativado",
        entidade: "usuario",
        entidadeId: usuarioId,
      },
      tx,
    );
  });
}
