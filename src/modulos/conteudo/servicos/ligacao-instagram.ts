import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { etapaAposPublicacoes } from "../regras/etapas";
import { ordenarCandidatas, validarLigacao } from "../regras/instagram";
import { MENSAGEM_NAO_ENCONTRADO } from "./contas";

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
      data: { publicacaoId, desligadaEm: null },
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
    await tx.midiaInstagram.update({ where: { id: midiaId }, data: { publicacaoId: null, desligadaEm: new Date() } });
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

// ---------------------------------------------------------------- Ligação manual (regra 5.13)

function exigirUso(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "conteudo:usar")) throw new ErroPermissao("conteudo:usar");
}

async function exigirMidia(midiaId: string) {
  const midia = await prisma.midiaInstagram.findUnique({
    where: { id: midiaId },
    select: { id: true, publicadoEm: true, removidaEm: true, publicacaoId: true, conta: { select: { canalId: true } } },
  });
  if (!midia) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return midia;
}

/** Conteúdos aprovados ou publicados com publicação livre no canal do post, mais perto da data do post primeiro. */
export async function candidatasParaLigar(ator: UsuarioAtual, midiaId: string) {
  exigirUso(ator);
  const midia = await exigirMidia(midiaId);
  if (!midia.conta.canalId) return [];
  const pubs = await prisma.publicacao.findMany({
    where: {
      canalId: midia.conta.canalId,
      midia: { is: null },
      conteudo: { excluidoEm: null, etapa: { in: ["aprovado", "publicado"] } },
    },
    select: { id: true, conteudo: { select: { id: true, titulo: true, dataPublicacao: true } } },
    take: 200,
  });
  return ordenarCandidatas(
    midia.publicadoEm,
    pubs.map((p) => ({
      publicacaoId: p.id,
      conteudoId: p.conteudo.id,
      titulo: p.conteudo.titulo,
      dataPublicacao: p.conteudo.dataPublicacao,
    })),
  ).slice(0, 30);
}

export async function ligarMidia(ator: UsuarioAtual, midiaId: string, publicacaoId: string) {
  exigirUso(ator);
  const midia = await exigirMidia(midiaId);
  if (midia.publicacaoId) throw new ErroNegocio("Este post já está ligado a um conteúdo.");
  const pub = await prisma.publicacao.findUnique({
    where: { id: publicacaoId },
    select: { canalId: true, midia: { select: { id: true } }, conteudo: { select: { etapa: true, excluidoEm: true } } },
  });
  const motivo = validarLigacao(
    { removidaEm: midia.removidaEm, canalId: midia.conta.canalId },
    {
      canalId: pub?.canalId ?? "",
      temMidia: Boolean(pub?.midia),
      etapa: pub?.conteudo.etapa ?? "",
      excluido: !pub || Boolean(pub.conteudo.excluidoEm),
    },
  );
  if (motivo) throw new ErroNegocio(motivo);
  await ligarNoBanco(midiaId, publicacaoId);
}

export async function desligarMidia(ator: UsuarioAtual, midiaId: string) {
  exigirUso(ator);
  await exigirMidia(midiaId);
  await desligarNoBanco(midiaId);
}
