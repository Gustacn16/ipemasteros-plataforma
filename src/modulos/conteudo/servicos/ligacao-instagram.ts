import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { etapaAposPublicacoes } from "../regras/etapas";

type Tx = Prisma.TransactionClient;

const camposNumeros = {
  alcance: true,
  visualizacoes: true,
  curtidas: true,
  comentarios: true,
  compartilhamentos: true,
  salvamentos: true,
} as const;

/** Números do post no formato da publicação (os campos que a C1 já mostra). */
const numerosDaMidia = (m: Prisma.MidiaInstagramGetPayload<{ select: typeof camposNumeros & { metricasEm: true } }>) => ({
  alcance: m.alcance,
  visualizacoes: m.visualizacoes,
  curtidas: m.curtidas,
  comentarios: m.comentarios,
  compartilhamentos: m.compartilhamentos,
  salvamentos: m.salvamentos,
  metricasEm: m.metricasEm,
});

/** Recalcula a etapa do conteúdo depois de mudar uma publicação (regra 5 da C1). */
async function recalcularEtapa(tx: Tx, conteudoId: string) {
  const conteudo = await tx.conteudo.findUniqueOrThrow({ where: { id: conteudoId }, select: { etapa: true } });
  const status = await tx.publicacao.findMany({ where: { conteudoId }, select: { status: true, publicadoEm: true } });
  const etapa = etapaAposPublicacoes(
    conteudo.etapa,
    status.map((s) => s.status),
  );
  const ultima = status.reduce<Date | null>((m, s) => (s.publicadoEm && (!m || s.publicadoEm > m) ? s.publicadoEm : m), null);
  await tx.conteudo.update({ where: { id: conteudoId }, data: { etapa, publicadoEm: etapa === "publicado" ? ultima : null } });
}

/**
 * Liga o post à publicação (regra 5.14): a publicação fica publicada com o link e a data
 * do post, os números passam a vir do Instagram e a etapa do conteúdo é recalculada.
 */
export async function ligarNoBanco(midiaId: string, publicacaoId: string) {
  await prisma.$transaction(async (tx) => {
    const midia = await tx.midiaInstagram.update({
      where: { id: midiaId },
      data: { publicacaoId },
      select: { ...camposNumeros, metricasEm: true, permalink: true, publicadoEm: true },
    });
    const pub = await tx.publicacao.update({
      where: { id: publicacaoId },
      data: {
        status: "publicado",
        url: midia.permalink.slice(0, 500),
        publicadoEm: midia.publicadoEm,
        metricasOrigem: "instagram",
        ...numerosDaMidia(midia),
      },
      select: { conteudoId: true },
    });
    await recalcularEtapa(tx, pub.conteudoId);
  });
}

/** Desfaz a ligação: os números ficam como estavam e voltam a ser editáveis. */
export async function desligarNoBanco(midiaId: string) {
  await prisma.$transaction(async (tx) => {
    const midia = await tx.midiaInstagram.findUniqueOrThrow({ where: { id: midiaId }, select: { publicacaoId: true } });
    if (!midia.publicacaoId) return;
    await tx.midiaInstagram.update({ where: { id: midiaId }, data: { publicacaoId: null } });
    await tx.publicacao.update({ where: { id: midia.publicacaoId }, data: { metricasOrigem: "manual" } });
  });
}

/** Copia os números de todos os posts ligados da conta para as publicações. */
export async function copiarNumerosLigados(contaId: string) {
  const ligadas = await prisma.midiaInstagram.findMany({
    where: { contaId, publicacaoId: { not: null }, metricasEm: { not: null } },
    select: { ...camposNumeros, metricasEm: true, publicacaoId: true },
  });
  if (ligadas.length === 0) return;
  await prisma.$transaction(
    ligadas.map((m) =>
      prisma.publicacao.update({ where: { id: m.publicacaoId! }, data: { metricasOrigem: "instagram", ...numerosDaMidia(m) } }),
    ),
  );
}
