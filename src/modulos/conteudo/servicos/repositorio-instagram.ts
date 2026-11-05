import "server-only";
import { prisma } from "@/lib/prisma";
import { INICIO_HISTORICO_INSTAGRAM } from "../regras/instagram";
import type { RepositorioInstagram } from "./atualizacao-instagram";
import { copiarNumerosLigados, ligarNoBanco } from "./ligacao-instagram";

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const corta = (texto: string | null, max: number) => (texto && texto.length > max ? null : texto);

/** Repositório da atualização do Instagram no banco (Prisma). */
export const repositorioPrisma: RepositorioInstagram = {
  emAndamento: (tipo) =>
    prisma.atualizacaoInstagram.findFirst({
      where: { tipo, status: "em_andamento" },
      orderBy: { iniciadoEm: "desc" },
      select: { iniciadoEm: true },
    }),
  async marcarInterrompidas(tipo, antesDe) {
    await prisma.atualizacaoInstagram.updateMany({
      where: { tipo, status: "em_andamento", iniciadoEm: { lt: antesDe } },
      data: { status: "falhou", finalizadoEm: new Date(), erro: "Interrompida." },
    });
  },
  criarAtualizacao: (d) =>
    prisma.atualizacaoInstagram.create({
      data: {
        tipo: d.tipo,
        origem: d.origem,
        iniciadaPorId: d.usuarioId,
        ...(d.iniciadoEm ? { iniciadoEm: d.iniciadoEm } : {}),
        ...(d.status ? { status: d.status, finalizadoEm: d.finalizadoEm, erro: d.erro } : {}),
      },
      select: { id: true },
    }),
  async fecharAtualizacao(id, d) {
    await prisma.atualizacaoInstagram.update({ where: { id }, data: d });
  },
  async salvarContas(contas) {
    await prisma.$transaction(
      contas.map((c) => {
        const dados = {
          usuario: c.usuario.slice(0, 60),
          nome: c.nome?.slice(0, 100) ?? null,
          paginaId: c.paginaId,
          fotoUrl: corta(c.fotoUrl, 1000),
        };
        // `canalId` e `ativa` são escolhas do admin: não mudam na atualização.
        return prisma.contaInstagram.upsert({
          where: { idExterno: c.idExterno },
          create: { idExterno: c.idExterno, ...dados },
          update: dados,
        });
      }),
    );
  },
  contasParaImportar: () =>
    prisma.contaInstagram.findMany({
      where: { ativa: true, canalId: { not: null } },
      select: { id: true, idExterno: true },
      orderBy: { usuario: "asc" },
    }),
  temMidias: async (contaId) => (await prisma.midiaInstagram.count({ where: { contaId, tipo: { not: "story" } } })) > 0,
  temHistoricoConta: async (contaId) =>
    (await prisma.metricaContaInstagram.count({ where: { contaId, periodo: "mes", data: dataDoDia(INICIO_HISTORICO_INSTAGRAM) } })) > 0,
  async salvarMidias(contaId, midias) {
    const salvas = await prisma.$transaction(
      midias.map((m) => {
        const dados = {
          tipo: m.tipo,
          legenda: m.legenda,
          permalink: m.permalink.slice(0, 500),
          codigo: m.codigo.slice(0, 40),
          miniaturaUrl: corta(m.miniaturaUrl, 1000),
          publicadoEm: m.publicadoEm,
          removidaEm: null,
        };
        return prisma.midiaInstagram.upsert({
          where: { idExterno: m.idExterno },
          create: { contaId, idExterno: m.idExterno, ...dados },
          update: dados,
          select: { id: true, idExterno: true },
        });
      }),
    );
    return new Map(salvas.map((s) => [s.idExterno, s.id]));
  },
  async marcarRemovidas(contaId, desde, vistos, agora) {
    const r = await prisma.midiaInstagram.updateMany({
      where: { contaId, tipo: { not: "story" }, publicadoEm: { gte: desde }, idExterno: { notIn: vistos }, removidaEm: null },
      data: { removidaEm: agora },
    });
    return r.count;
  },
  async midiasParaNumeros(contaId, o) {
    const base = { contaId, tipo: { not: "story" as const }, removidaEm: null };
    const select = { id: true, idExterno: true, tipo: true };
    const sem = await prisma.midiaInstagram.findMany({ where: { ...base, metricasEm: null }, select, orderBy: { publicadoEm: "desc" } });
    const com = await prisma.midiaInstagram.findMany({
      where: { ...base, metricasEm: { not: null }, ...(o.todas ? {} : { publicadoEm: { gte: o.desde } }) },
      select,
      orderBy: { publicadoEm: "desc" },
    });
    return [...sem, ...com];
  },
  async salvarNumerosMidia(id, numeros, agora) {
    await prisma.midiaInstagram.update({ where: { id }, data: { ...numeros, metricasEm: agora } });
  },
  async salvarLinhaConta(contaId, periodo, dia, numeros) {
    const data = dataDoDia(dia);
    await prisma.metricaContaInstagram.upsert({
      where: { contaId_periodo_data: { contaId, periodo, data } },
      create: { contaId, periodo, data, ...numeros },
      update: numeros,
    });
  },
  async salvarSeguidores(contaId, dia, seguidores) {
    const data = dataDoDia(dia);
    await prisma.metricaContaInstagram.upsert({
      where: { contaId_periodo_data: { contaId, periodo: "dia", data } },
      create: { contaId, periodo: "dia", data, seguidores },
      update: { seguidores },
    });
  },
  midiasSemLigacao: (contaId) =>
    prisma.midiaInstagram.findMany({
      where: { contaId, publicacaoId: null, removidaEm: null, desligadaEm: null },
      select: { id: true, codigo: true },
    }),
  async publicacoesCandidatas(contaId) {
    const pubs = await prisma.publicacao.findMany({
      where: { canal: { contaInstagram: { id: contaId } }, midia: { is: null }, conteudo: { excluidoEm: null } },
      select: { id: true, url: true, conteudo: { select: { etapa: true } } },
    });
    return pubs.map((p) => ({ id: p.id, url: p.url, etapa: p.conteudo.etapa }));
  },
  ligar: ligarNoBanco,
  copiarNumerosLigados,
};
