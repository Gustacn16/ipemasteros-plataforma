import "server-only";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { MAX_GRUPOS_POR_AVISO } from "../regras/avisos";

const ESCOPO = "whatsapp:avisos";

export type TipoParaAvisos = { id: string; nome: string; cor: string; divulgar: boolean; grupos: string[] };

const esquemaTipo = z.object({
  tipoId: z.string().min(1).max(40),
  divulgar: z.boolean(),
  grupos: z
    .array(z.string().min(1).max(40))
    .max(MAX_GRUPOS_POR_AVISO, `Escolha no máximo ${MAX_GRUPOS_POR_AVISO} grupos.`)
    .transform((ids) => [...new Set(ids)]),
});

function exigir(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, ESCOPO)) throw new ErroPermissao(ESCOPO);
}

/** Tipos de evento ativos, com a marca de divulgação e os grupos padrão de cada um. */
export async function listarTiposParaAvisos(ator: UsuarioAtual): Promise<TipoParaAvisos[]> {
  exigir(ator);
  const tipos = await prisma.tipoEvento.findMany({
    where: { ativo: true },
    include: { gruposPadrao: { select: { conversaId: true } } },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });
  return tipos.map((t) => ({
    id: t.id,
    nome: t.nome,
    cor: t.cor,
    divulgar: t.divulgarNosGrupos,
    grupos: t.gruposPadrao.map((g) => g.conversaId),
  }));
}

/** Liga ou desliga a divulgação de um tipo e troca os grupos padrão dele. */
export async function salvarTipoParaAvisos(ator: UsuarioAtual, dados: unknown): Promise<void> {
  exigir(ator);
  const v = esquemaTipo.parse(dados);
  await prisma.$transaction(async (tx) => {
    const tipo = await tx.tipoEvento.findUnique({ where: { id: v.tipoId }, select: { id: true, ativo: true } });
    if (!tipo || !tipo.ativo) throw new ErroNegocio("Tipo de evento não encontrado.");
    const validos = v.grupos.length
      ? await tx.conversaWhatsapp.findMany({ where: { id: { in: v.grupos }, tipo: "grupo", monitorada: true }, select: { id: true } })
      : [];
    if (validos.length !== v.grupos.length) throw new ErroNegocio("Algum grupo escolhido não está mais disponível.");
    await tx.tipoEvento.update({ where: { id: v.tipoId }, data: { divulgarNosGrupos: v.divulgar } });
    await tx.grupoPadraoTipoEvento.deleteMany({ where: { tipoId: v.tipoId } });
    if (v.grupos.length > 0) {
      await tx.grupoPadraoTipoEvento.createMany({ data: v.grupos.map((conversaId) => ({ tipoId: v.tipoId, conversaId })) });
    }
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.avisos.config",
        entidade: "TipoEvento",
        entidadeId: v.tipoId,
        diff: { divulgar: v.divulgar, grupos: v.grupos.length },
      },
      tx,
    );
  });
}
