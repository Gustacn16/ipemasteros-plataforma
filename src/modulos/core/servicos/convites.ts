import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { escaparHtml, enviarEmail } from "@/lib/email";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, podeConvidar, ROTULO_PAPEL, temPermissao, type Papel } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { gerarToken, hashToken } from "@/lib/tokens";
import type { DadosPerfil } from "../esquemas/usuario";
import { salvarPerfil, type FotoEnviada } from "./perfil";
import { criarUsuarioComSenha } from "./usuarios";

const VALIDADE_CONVITE_MS = 72 * 60 * 60 * 1000;

function urlBase() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function listarConvitesPendentes() {
  return prisma.convite.findMany({
    where: { aceitoEm: null, revogadoEm: null, expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      expiraEm: true,
      convidadoPor: { select: { nome: true } },
    },
  });
}

/**
 * Cria o convite e envia o e-mail. Retorna o link para a tela poder exibi-lo
 * (útil enquanto o SMTP não estiver configurado).
 */
export async function criarConvite(
  ator: UsuarioAtual,
  dados: { nome: string; email: string; papel: Papel },
): Promise<{ link: string }> {
  if (!temPermissao(ator.papel, "core:convidar_usuario")) {
    throw new ErroPermissao("core:convidar_usuario");
  }
  if (!podeConvidar(ator.papel, dados.papel)) {
    throw new ErroNegocio(`Seu papel não pode convidar ${ROTULO_PAPEL[dados.papel]}.`);
  }

  const token = gerarToken();
  const link = `${urlBase()}/convite/${token}`;

  await prisma.$transaction(async (tx) => {
    const existente = await tx.usuario.findUnique({ where: { email: dados.email } });
    if (existente) throw new ErroNegocio("Já existe um usuário com este e-mail.");

    // Um convite pendente por e-mail: o novo substitui o anterior.
    await tx.convite.updateMany({
      where: { email: dados.email, aceitoEm: null, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    const convite = await tx.convite.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        papel: dados.papel,
        tokenHash: hashToken(token),
        expiraEm: new Date(Date.now() + VALIDADE_CONVITE_MS),
        convidadoPorId: ator.id,
      },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "usuario.convidado",
        entidade: "convite",
        entidadeId: convite.id,
        diff: { papel: dados.papel },
      },
      tx,
    );
  });

  await enviarEmail({
    para: dados.email,
    assunto: "Seu acesso ao IPEMaster OS",
    texto: `Olá, ${dados.nome}.\n\n${ator.nome} convidou você para o IPEMaster OS como ${ROTULO_PAPEL[dados.papel]}.\nPara criar sua senha, acesse (válido por 72 horas):\n${link}`,
    html: `<p>Olá, ${escaparHtml(dados.nome)}.</p><p>${escaparHtml(ator.nome)} convidou você para o IPEMaster OS como <strong>${ROTULO_PAPEL[dados.papel]}</strong>.</p><p><a href="${link}">Criar minha senha</a> (válido por 72 horas).</p>`,
  });

  return { link };
}

export async function revogarConvite(ator: UsuarioAtual, conviteId: string) {
  if (!temPermissao(ator.papel, "core:convidar_usuario")) {
    throw new ErroPermissao("core:convidar_usuario");
  }
  await prisma.$transaction(async (tx) => {
    const convite = await tx.convite.findUnique({ where: { id: conviteId } });
    if (!convite || convite.aceitoEm || convite.revogadoEm) {
      throw new ErroNegocio("Convite não encontrado ou já encerrado.");
    }
    if (!podeConvidar(ator.papel, convite.papel)) {
      throw new ErroNegocio("Seu papel não pode revogar este convite.");
    }
    await tx.convite.update({ where: { id: conviteId }, data: { revogadoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "usuario.convite_revogado", entidade: "convite", entidadeId: conviteId },
      tx,
    );
  });
}

/** Convite válido pelo token do link, ou null (expirado, usado, revogado ou inexistente). */
export async function buscarConviteValido(token: string) {
  const convite = await prisma.convite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!convite || convite.aceitoEm || convite.revogadoEm || convite.expiraEm <= new Date()) {
    return null;
  }
  return { id: convite.id, nome: convite.nome, email: convite.email, papel: convite.papel };
}

/** Cria o usuário a partir do convite, já com perfil e foto, e marca o convite como aceito. */
export async function aceitarConvite(dados: DadosPerfil & { token: string; senha: string }, foto: FotoEnviada) {
  return prisma.$transaction(async (tx) => {
    const convite = await tx.convite.findUnique({ where: { tokenHash: hashToken(dados.token) } });
    if (!convite || convite.aceitoEm || convite.revogadoEm || convite.expiraEm <= new Date()) {
      throw new ErroNegocio("Este convite expirou ou já foi usado. Peça um novo convite.");
    }
    const usuario = await criarUsuarioComSenha(tx, {
      nome: dados.nome,
      email: convite.email,
      senha: dados.senha,
      papel: convite.papel,
    });
    await salvarPerfil(tx, usuario.id, dados, foto);
    await tx.convite.update({ where: { id: convite.id }, data: { aceitoEm: new Date() } });
    await registrarAuditoria(
      {
        usuarioId: usuario.id,
        acao: "usuario.convite_aceito",
        entidade: "usuario",
        entidadeId: usuario.id,
        diff: { conviteId: convite.id, papel: convite.papel },
      },
      tx,
    );
    return { email: usuario.email };
  });
}
