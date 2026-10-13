import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";

export const ITENS_POR_PAGINA = 50;

export type FiltrosAuditoria = { acao?: string; usuarioId?: string; pagina?: number };

/**
 * Admin vê tudo. Gestor vê só as ações feitas por ele mesmo
 * (escopo mínimo da F0; ver docs/modulos/core.md).
 */
export async function listarLogs(ator: UsuarioAtual, filtros: FiltrosAuditoria) {
  if (!temPermissao(ator.papel, "core:ver_auditoria")) throw new ErroPermissao("core:ver_auditoria");

  const where: Prisma.LogAuditoriaWhereInput = {
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(ator.papel === "admin"
      ? filtros.usuarioId
        ? { usuarioId: filtros.usuarioId }
        : {}
      : { usuarioId: ator.id }),
  };
  const pagina = Math.max(1, filtros.pagina ?? 1);

  const [total, logs] = await prisma.$transaction([
    prisma.logAuditoria.count({ where }),
    prisma.logAuditoria.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
      select: {
        id: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        diff: true,
        ip: true,
        criadoEm: true,
        usuario: { select: { nome: true, email: true } },
      },
    }),
  ]);

  return { logs, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / ITENS_POR_PAGINA)) };
}
