import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { exigir } from "./acesso";

/**
 * Link de assinatura .ics do calendário institucional (spec, regra 7).
 * O token (32 bytes em base64url) só aparece na hora em que é gerado; o banco guarda o SHA-256.
 * Gerar de novo troca o hash, e o link anterior para de funcionar na hora.
 */

/** 32 bytes em base64url sem preenchimento = 43 caracteres. */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

const hashDoToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function temLinkAssinatura(ator: UsuarioAtual): Promise<boolean> {
  exigir(ator, "agenda:usar");
  const linha = await prisma.assinaturaAgenda.findUnique({ where: { usuarioId: ator.id }, select: { usuarioId: true } });
  return linha !== null;
}

/** Gera (ou troca) o link e devolve o endereço completo, que não pode ser mostrado de novo. */
export async function gerarLinkAssinatura(ator: UsuarioAtual, origem: string): Promise<string> {
  exigir(ator, "agenda:usar");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashDoToken(token);
  await prisma.$transaction(async (tx) => {
    await tx.assinaturaAgenda.upsert({
      where: { usuarioId: ator.id },
      create: { usuarioId: ator.id, tokenHash },
      update: { tokenHash, criadoEm: new Date() },
    });
    // Nunca registrar o token nem o hash.
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "agenda.assinatura_gerada", entidade: "AssinaturaAgenda", entidadeId: ator.id },
      tx,
    );
  });
  return `${origem.replace(/\/+$/, "")}/api/agenda/assinatura/${token}.ics`;
}

/** Dono do token, se for um usuário ativo. A busca é pelo hash, no índice único. */
export async function usuarioDoToken(token: string): Promise<UsuarioAtual | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const linha = await prisma.assinaturaAgenda.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: {
      usuario: {
        select: { id: true, nome: true, apelido: true, email: true, papel: true, ativo: true, imagem: true, perfilCompletoEm: true },
      },
    },
  });
  const usuario = linha?.usuario;
  if (!usuario?.ativo) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    apelido: usuario.apelido,
    email: usuario.email,
    papel: usuario.papel,
    imagem: usuario.imagem,
    perfilCompleto: usuario.perfilCompletoEm !== null,
  };
}
