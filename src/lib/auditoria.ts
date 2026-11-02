import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AcaoAuditoria =
  | "auth.login"
  | "auth.logout"
  | "auth.primeiro_acesso"
  | "auth.senha_redefinida"
  | "usuario.convidado"
  | "usuario.convite_revogado"
  | "usuario.convite_aceito"
  | "usuario.papel_alterado"
  | "usuario.desativado"
  | "usuario.reativado"
  | "usuario.perfil_atualizado"
  | "espaco.criado"
  | "espaco.excluido"
  | "espaco.membros_alterados"
  | "conteudo.aprovado"
  | "conteudo.publicacao_registrada"
  | "agenda.evento_criado"
  | "agenda.evento_editado"
  | "agenda.evento_excluido"
  | "agenda.tipo_alterado"
  | "agenda.assinatura_gerada";

type DadosAuditoria = {
  usuarioId: string | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  /** Antes/depois. NUNCA incluir CPF em claro, senhas ou tokens. */
  diff?: Prisma.InputJsonValue;
};

type ClienteTransacao = Pick<typeof prisma, "logAuditoria">;

export async function obterOrigemRequisicao(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 500) ?? null };
  } catch {
    // Fora de uma requisição (ex.: seed, job) não há cabeçalhos.
    return { ip: null, userAgent: null };
  }
}

/**
 * Grava um registro de auditoria. Passe `tx` para gravar dentro da mesma
 * transação da ação auditada (regra 7 de docs/modulos/core.md).
 */
export async function registrarAuditoria(dados: DadosAuditoria, tx: ClienteTransacao = prisma) {
  const origem = await obterOrigemRequisicao();
  await tx.logAuditoria.create({
    data: {
      usuarioId: dados.usuarioId,
      acao: dados.acao,
      entidade: dados.entidade,
      entidadeId: dados.entidadeId ?? null,
      diff: dados.diff,
      ...origem,
    },
  });
}
