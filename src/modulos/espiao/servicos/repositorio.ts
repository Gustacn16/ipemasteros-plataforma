import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ColetaR, ErroColeta, Passos, RepositorioEspiao } from "./coleta";

function paraColeta(c: { id: string; origem: ColetaR["origem"]; status: ColetaR["status"]; iniciadaEm: Date; progressoEm: Date; passos: Prisma.JsonValue; erros: Prisma.JsonValue }): ColetaR {
  const passos = (c.passos ?? {}) as Partial<Passos>;
  return { ...c, passos: { concorrentes: passos.concorrentes ?? {}, analise: passos.analise }, erros: Array.isArray(c.erros) ? (c.erros as ErroColeta[]) : [] };
}

const COLETA = { id: true, origem: true, status: true, iniciadaEm: true, progressoEm: true, passos: true, erros: true } as const;
const MIDIA = {
  id: true, idExterno: true, tipo: true, legenda: true, permalink: true, publicadoEm: true, curtidas: true, comentarios: true,
  visualizacoes: true, transcricao: true, resumo: true, situacaoTranscricao: true,
} as const;

export const repositorioPrisma: RepositorioEspiao = {
  async coletaRodando() {
    const c = await prisma.coletaEspiao.findFirst({ where: { status: "rodando" }, orderBy: { iniciadaEm: "desc" }, select: COLETA });
    return c ? paraColeta(c) : null;
  },
  async ultimaFinalizada() {
    return prisma.coletaEspiao.findFirst({ where: { status: { in: ["concluida", "parcial"] } }, orderBy: { iniciadaEm: "desc" }, select: { iniciadaEm: true } });
  },
  async criarColeta(origem, agora) {
    const c = await prisma.coletaEspiao.create({ data: { origem, iniciadaEm: agora, progressoEm: agora, passos: { concorrentes: {} }, erros: [] }, select: COLETA });
    return paraColeta(c);
  },
  async obterColeta(id) {
    return paraColeta(await prisma.coletaEspiao.findUniqueOrThrow({ where: { id }, select: COLETA }));
  },
  async salvarProgresso(id, d, agora) {
    await prisma.coletaEspiao.update({ where: { id }, data: { passos: d.passos as Prisma.InputJsonValue, erros: d.erros as Prisma.InputJsonValue, progressoEm: agora } });
  },
  async finalizarColeta(id, status, agora) {
    await prisma.coletaEspiao.update({ where: { id }, data: { status, finalizadaEm: agora, progressoEm: agora } });
  },
  async concorrentesAtivos() {
    return prisma.concorrente.findMany({ where: { ativo: true, excluidoEm: null }, orderBy: { nome: "asc" }, select: { id: true, nome: true, instagram: true } });
  },
  async fotos(concorrenteId) {
    return prisma.fotoInstagram.findMany({
      where: { concorrenteId },
      orderBy: { capturadaEm: "desc" },
      take: 60,
      select: { coletaId: true, seguidores: true, totalPosts: true, biografia: true, site: true, capturadaEm: true },
    });
  },
  async salvarFoto(concorrenteId, coletaId, d, agora) {
    await prisma.fotoInstagram.create({ data: { concorrenteId, coletaId, ...d, capturadaEm: agora } });
  },
  async midias(concorrenteId) {
    return prisma.midiaConcorrente.findMany({ where: { concorrenteId }, orderBy: { publicadoEm: "desc" }, take: 120, select: MIDIA });
  },
  async salvarMidia(concorrenteId, m, situacaoSeNova, agora) {
    const metricas = { curtidas: m.curtidas, comentarios: m.comentarios, visualizacoes: m.visualizacoes, legenda: m.legenda, metricasEm: agora };
    await prisma.midiaConcorrente.upsert({
      where: { idExterno: m.idExterno },
      update: metricas,
      create: { concorrenteId, idExterno: m.idExterno, tipo: m.tipo, permalink: m.permalink, publicadoEm: m.publicadoEm, situacaoTranscricao: situacaoSeNova, ...metricas },
    });
  },
  async atualizarMidia(id, d) {
    await prisma.midiaConcorrente.update({ where: { id }, data: d });
  },
  async paginas(concorrenteId) {
    return prisma.paginaConcorrente.findMany({
      where: { concorrenteId, ativa: true, excluidoEm: null },
      orderBy: { rotulo: "asc" },
      select: { id: true, url: true, rotulo: true, legivel: true, ultimoHash: true, ultimaCapturaEm: true },
    });
  },
  async ultimaVersao(paginaId) {
    const v = await prisma.versaoPagina.findFirst({ where: { paginaId }, orderBy: { capturadaEm: "desc" }, select: { texto: true, precos: true } });
    return v ? { texto: v.texto, precos: Array.isArray(v.precos) ? (v.precos as string[]) : [] } : null;
  },
  async salvarCaptura(paginaId, d, agora) {
    await prisma.$transaction(async (tx) => {
      if (d.novaVersao) await tx.versaoPagina.create({ data: { paginaId, hash: d.hash, texto: d.texto, precos: d.precos, capturadaEm: agora } });
      await tx.paginaConcorrente.update({
        where: { id: paginaId },
        data: { legivel: d.legivel, ultimaCapturaEm: agora, ...(d.novaVersao ? { ultimoHash: d.hash } : {}) },
      });
    });
  },
  async chavesExistentes(chaves) {
    if (chaves.length === 0) return new Set();
    const achados = await prisma.sinalEspiao.findMany({ where: { chave: { in: chaves } }, select: { chave: true } });
    return new Set(achados.flatMap((s) => (s.chave ? [s.chave] : [])));
  },
  async criarSinais(coletaId, concorrenteId, sinais, agora) {
    await prisma.sinalEspiao.createMany({
      data: sinais.map((s) => ({
        coletaId,
        concorrenteId,
        tipo: s.tipo,
        titulo: s.titulo.slice(0, 300),
        detalhe: s.detalhe as Prisma.InputJsonValue,
        origemUrl: s.origemUrl?.slice(0, 500) ?? null,
        chave: s.chave.slice(0, 120),
        criadoEm: agora,
      })),
      skipDuplicates: true,
    });
  },
  async sinaisDaColeta(coletaId) {
    const sinais = await prisma.sinalEspiao.findMany({
      where: { coletaId },
      orderBy: { criadoEm: "asc" },
      select: { tipo: true, titulo: true, detalhe: true, concorrente: { select: { nome: true } } },
    });
    return sinais.map((s) => ({ concorrente: s.concorrente.nome, tipo: s.tipo, titulo: s.titulo, detalhe: (s.detalhe ?? {}) as Record<string, unknown> }));
  },
  async salvarRelatorio(coletaId, analise) {
    await prisma.relatorioEspiao.upsert({ where: { coletaId }, update: { analise }, create: { coletaId, analise } });
  },
};
