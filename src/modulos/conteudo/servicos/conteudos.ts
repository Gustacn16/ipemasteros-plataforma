import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import type { FiltroConteudo, Formato } from "../esquemas/conteudo";
import { gradeDoMes, proximoMes } from "../regras/calendario";
import { ETAPAS_DO_QUADRO, etapaAposPublicacoes, validarMudancaEtapa, type Etapa } from "../regras/etapas";
import { MENSAGEM_NAO_ENCONTRADO } from "./contas";

function exigirUso(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "conteudo:usar")) throw new ErroPermissao("conteudo:usar");
}
const podeAprovar = (ator: UsuarioAtual) => temPermissao(ator.papel, "conteudo:aprovar");

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const hojeSP = () => diaEmSaoPaulo(new Date());

/** Início do dia "AAAA-MM-DD" em São Paulo (UTC−3 fixo, sem horário de verão) como instante UTC. */
const inicioDoDiaSP = (dia: string) => new Date(`${dia}T03:00:00Z`);

function whereFiltro(f: FiltroConteudo): Prisma.ConteudoWhereInput {
  return {
    excluidoEm: null,
    marca: { excluidoEm: null },
    ...(f.marca ? { marcaId: f.marca } : {}),
    ...(f.canal ? { publicacoes: { some: { canalId: f.canal } } } : {}),
    ...(f.responsavel ? { responsavelId: f.responsavel } : {}),
    ...(f.formato ? { formato: f.formato } : {}),
    // AND para somar com o recorte de etapa que cada visão já aplica.
    ...(f.etapa ? { AND: [{ etapa: f.etapa }] } : {}),
  };
}

/** Pessoas que podem ser responsáveis por um conteúdo. */
export function listarPessoas() {
  return prisma.usuario.findMany({
    where: { ativo: true, papel: { in: ["admin", "gestor", "colaborador"] } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

const selecaoCartao = {
  id: true,
  titulo: true,
  formato: true,
  etapa: true,
  dataPublicacao: true,
  dataGravacao: true,
  marca: { select: { nome: true, cor: true } },
  responsavel: { select: { id: true, nome: true } },
  publicacoes: { select: { status: true, canal: { select: { plataforma: true } } } },
} satisfies Prisma.ConteudoSelect;
export type CartaoConteudo = Prisma.ConteudoGetPayload<{ select: typeof selecaoCartao }>;

const ordemPorData: Prisma.ConteudoOrderByWithRelationInput[] = [{ dataPublicacao: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }];

export async function listarQuadro(ator: UsuarioAtual, f: FiltroConteudo) {
  exigirUso(ator);
  const itens = await prisma.conteudo.findMany({
    where: { ...whereFiltro(f), etapa: { in: [...ETAPAS_DO_QUADRO] } },
    orderBy: ordemPorData,
    select: selecaoCartao,
  });
  return Object.fromEntries(ETAPAS_DO_QUADRO.map((e) => [e, itens.filter((i) => i.etapa === e)])) as Record<
    (typeof ETAPAS_DO_QUADRO)[number],
    CartaoConteudo[]
  >;
}

export async function listarCalendario(ator: UsuarioAtual, mes: string, f: FiltroConteudo, comGravacoes: boolean) {
  exigirUso(ator);
  const grade = gradeDoMes(mes);
  const intervalo = { gte: dataDoDia(grade[0][0].dia), lte: dataDoDia(grade.at(-1)!.at(-1)!.dia) };
  const itens = await prisma.conteudo.findMany({
    where: {
      ...whereFiltro(f),
      etapa: { not: "cancelado" },
      OR: [{ dataPublicacao: intervalo }, ...(comGravacoes ? [{ dataGravacao: intervalo }] : [])],
    },
    orderBy: { criadoEm: "asc" },
    select: selecaoCartao,
  });
  return { grade, itens };
}

export async function listarGravacoes(ator: UsuarioAtual, f: FiltroConteudo) {
  exigirUso(ator);
  const [aGravar, gravados] = await Promise.all([
    prisma.conteudo.findMany({
      where: { ...whereFiltro(f), etapa: "a_gravar" },
      orderBy: [{ dataGravacao: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }],
      select: selecaoCartao,
    }),
    prisma.conteudo.findMany({
      where: { ...whereFiltro(f), etapa: { in: ["gravado", "edicao"] } },
      orderBy: ordemPorData,
      select: { ...selecaoCartao, linkMaterial: true },
    }),
  ]);
  return { aGravar, gravados };
}

export async function listarPublicados(ator: UsuarioAtual, mes: string, f: FiltroConteudo) {
  exigirUso(ator);
  const publicacoes = await prisma.publicacao.findMany({
    where: {
      status: "publicado",
      publicadoEm: { gte: inicioDoDiaSP(`${mes}-01`), lt: inicioDoDiaSP(`${proximoMes(mes)}-01`) },
      conteudo: whereFiltro({ ...f, canal: undefined, etapa: undefined }),
      ...(f.canal ? { canalId: f.canal } : {}),
    },
    orderBy: { publicadoEm: "desc" },
    select: {
      id: true,
      url: true,
      publicadoEm: true,
      alcance: true,
      visualizacoes: true,
      curtidas: true,
      comentarios: true,
      compartilhamentos: true,
      salvamentos: true,
      conteudo: { select: { id: true, titulo: true, formato: true, marca: { select: { nome: true, cor: true } } } },
      canal: { select: { id: true, plataforma: true, identificador: true } },
      // Ligada a um post do Instagram: aparece na seção Instagram de Publicados, não na lista de publicações.
      midia: { select: { id: true } },
    },
  });
  return publicacoes;
}
export type LinhaPublicado = Awaited<ReturnType<typeof listarPublicados>>[number];

export async function visaoGeral(ator: UsuarioAtual, f: FiltroConteudo) {
  exigirUso(ator);
  const hoje = hojeSP();
  const ativos: Prisma.ConteudoWhereInput = { ...whereFiltro(f), etapa: { notIn: ["publicado", "cancelado"] } };
  const mes = hoje.slice(0, 7);
  const [atrasados, proximos, gravacoes, aguardandoEdicao, ideias, publicadosMes] = await Promise.all([
    prisma.conteudo.findMany({
      where: { ...ativos, dataPublicacao: { lt: dataDoDia(hoje) } },
      orderBy: { dataPublicacao: "asc" },
      take: 20,
      select: selecaoCartao,
    }),
    prisma.conteudo.findMany({
      where: { ...ativos, dataPublicacao: { gte: dataDoDia(hoje), lte: dataDoDia(somarDias(hoje, 7)) } },
      orderBy: { dataPublicacao: "asc" },
      take: 20,
      select: selecaoCartao,
    }),
    prisma.conteudo.findMany({
      where: { ...whereFiltro(f), etapa: "a_gravar" },
      orderBy: { dataGravacao: { sort: "asc", nulls: "last" } },
      take: 10,
      select: selecaoCartao,
    }),
    prisma.conteudo.count({ where: { ...whereFiltro(f), etapa: { in: ["gravado", "edicao"] } } }),
    prisma.conteudo.count({ where: { ...whereFiltro(f), etapa: "ideia" } }),
    listarPublicados(ator, mes, f),
  ]);
  return { atrasados, proximos, gravacoes, aguardandoEdicao, ideias, publicadosMes };
}

export async function obterConteudo(ator: UsuarioAtual, conteudoId: string) {
  exigirUso(ator);
  const conteudo = await prisma.conteudo.findFirst({
    where: { id: conteudoId, excluidoEm: null, marca: { excluidoEm: null } },
    include: {
      marca: {
        select: {
          id: true,
          nome: true,
          cor: true,
          canais: {
            where: { excluidoEm: null },
            orderBy: { ordem: "asc" },
            select: { id: true, plataforma: true, identificador: true, ativo: true },
          },
        },
      },
      responsavel: { select: { id: true, nome: true } },
      criadoPor: { select: { nome: true } },
      aprovadoPor: { select: { nome: true } },
      publicacoes: {
        orderBy: { criadoEm: "asc" },
        include: {
          canal: { select: { id: true, plataforma: true, identificador: true } },
          midia: { select: { id: true, permalink: true } },
        },
      },
    },
  });
  if (!conteudo) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  const pessoas = await listarPessoas();
  return { conteudo, pessoas, podeAprovar: podeAprovar(ator) };
}

async function exigirConteudo(conteudoId: string) {
  const conteudo = await prisma.conteudo.findFirst({
    where: { id: conteudoId, excluidoEm: null },
    include: { publicacoes: { select: { id: true, canalId: true, status: true } } },
  });
  if (!conteudo) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return conteudo;
}

/** Canais precisam ser ativos e da marca do conteúdo (regra 7). */
async function validarCanais(marcaId: string, canalIds: string[], permitirInativos: string[] = []) {
  const ids = [...new Set(canalIds)];
  const validos = await prisma.canal.count({
    where: {
      id: { in: ids },
      marcaId,
      excluidoEm: null,
      OR: [{ ativo: true }, { id: { in: permitirInativos } }],
    },
  });
  if (validos !== ids.length) throw new ErroNegocio("Escolha canais ativos da mesma conta do conteúdo.");
  return ids;
}

export async function criarConteudo(
  ator: UsuarioAtual,
  dados: { marcaId: string; titulo: string; formato: Formato; canalIds: string[]; dataPublicacao: Date | null },
) {
  exigirUso(ator);
  const marca = await prisma.marca.findFirst({ where: { id: dados.marcaId, excluidoEm: null } });
  if (!marca) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  const canalIds = await validarCanais(dados.marcaId, dados.canalIds);
  return prisma.conteudo.create({
    data: {
      marcaId: dados.marcaId,
      titulo: dados.titulo,
      formato: dados.formato,
      dataPublicacao: dados.dataPublicacao,
      criadoPorId: ator.id,
      responsavelId: ator.id,
      publicacoes: { create: canalIds.map((canalId) => ({ canalId })) },
    },
  });
}

type CamposConteudo = {
  titulo: string;
  formato: Formato;
  canalIds: string[];
  dataPublicacao: Date | null;
  dataGravacao: Date | null;
  roteiro: string | null;
  legenda: string | null;
  linkMaterial: string | null;
  responsavelId: string | null;
};

export async function atualizarConteudo(ator: UsuarioAtual, conteudoId: string, campos: CamposConteudo) {
  exigirUso(ator);
  const { canalIds: canaisPedidos, ...dados } = campos;
  const atual = await exigirConteudo(conteudoId);
  const atuaisIds = atual.publicacoes.map((p) => p.canalId);
  const canalIds = await validarCanais(atual.marcaId, canaisPedidos, atuaisIds);

  const removidas = atual.publicacoes.filter((p) => !canalIds.includes(p.canalId));
  if (removidas.some((p) => p.status === "publicado")) {
    throw new ErroNegocio("Não dá para remover um canal em que o conteúdo já foi publicado. Desmarque a publicação antes.");
  }
  // Regra 1: depois de ideia, o conteúdo precisa de pelo menos um canal.
  if (canalIds.length === 0 && atual.etapa !== "ideia" && atual.etapa !== "cancelado") {
    throw new ErroNegocio("Escolha pelo menos um canal de destino.");
  }

  if (dados.responsavelId) {
    const ok = await prisma.usuario.count({ where: { id: dados.responsavelId, ativo: true } });
    if (!ok) throw new ErroNegocio("Responsável inválido.");
  }

  // Regra 5: quem não aprova e mexe no texto de um conteúdo aprovado devolve para revisão.
  const mudouTexto = dados.roteiro !== atual.roteiro || dados.legenda !== atual.legenda;
  const voltaRevisao = atual.etapa === "aprovado" && mudouTexto && !podeAprovar(ator);

  await prisma.$transaction(async (tx) => {
    await tx.publicacao.deleteMany({ where: { id: { in: removidas.map((p) => p.id) } } });
    await tx.publicacao.createMany({
      data: canalIds.filter((id) => !atuaisIds.includes(id)).map((canalId) => ({ conteudoId, canalId })),
    });
    const status = await tx.publicacao.findMany({ where: { conteudoId }, select: { status: true } });
    const etapa: Etapa = voltaRevisao
      ? "revisao"
      : etapaAposPublicacoes(
          atual.etapa,
          status.map((s) => s.status),
        );
    await tx.conteudo.update({
      where: { id: conteudoId },
      data: {
        ...dados,
        etapa,
        ...(voltaRevisao ? { aprovadoPorId: null, aprovadoEm: null } : {}),
        ...(etapa !== "publicado" ? { publicadoEm: null } : {}),
      },
    });
  });
  return { voltouParaRevisao: voltaRevisao };
}

export async function mudarEtapa(ator: UsuarioAtual, conteudoId: string, etapa: Etapa) {
  exigirUso(ator);
  const atual = await exigirConteudo(conteudoId);
  if (atual.etapa === "publicado") {
    throw new ErroNegocio("Este conteúdo já foi publicado. Para reabrir, desmarque a publicação em algum canal.");
  }
  const erro = validarMudancaEtapa({ para: etapa, podeAprovar: podeAprovar(ator), totalCanais: atual.publicacoes.length });
  if (erro) throw new ErroNegocio(erro);

  await prisma.$transaction(async (tx) => {
    await tx.conteudo.update({
      where: { id: conteudoId },
      data: {
        etapa,
        ...(etapa === "aprovado" ? { aprovadoPorId: ator.id, aprovadoEm: new Date() } : {}),
        ...(atual.etapa === "aprovado" && etapa !== "aprovado" ? { aprovadoPorId: null, aprovadoEm: null } : {}),
      },
    });
    if (etapa === "aprovado") {
      await registrarAuditoria({ usuarioId: ator.id, acao: "conteudo.aprovado", entidade: "Conteudo", entidadeId: conteudoId }, tx);
    }
  });
}

async function exigirPublicacao(publicacaoId: string) {
  const publicacao = await prisma.publicacao.findFirst({
    where: { id: publicacaoId, conteudo: { excluidoEm: null } },
    include: { conteudo: { select: { id: true, etapa: true } } },
  });
  if (!publicacao) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return publicacao;
}

/** Marca ou desmarca a publicação num canal (regras 3 e 4). */
export async function registrarPublicacao(
  ator: UsuarioAtual,
  publicacaoId: string,
  dados: { publicado: boolean; url: string | null; data: Date | null },
) {
  exigirUso(ator);
  const pub = await exigirPublicacao(publicacaoId);
  if (!dados.publicado && pub.metricasOrigem === "instagram") {
    throw new ErroNegocio("Desligue o post do Instagram antes de desmarcar esta publicação.");
  }
  if (dados.publicado && pub.conteudo.etapa !== "aprovado" && pub.conteudo.etapa !== "publicado") {
    throw new ErroNegocio("O conteúdo precisa estar aprovado antes de ser marcado como publicado.");
  }
  // Data informada vira meio-dia de São Paulo daquele dia; sem data, agora.
  const publicadoEm = dados.publicado ? (dados.data ? new Date(dados.data.getTime() + 15 * 3600_000) : new Date()) : null;

  await prisma.$transaction(async (tx) => {
    await tx.publicacao.update({
      where: { id: publicacaoId },
      data: { status: dados.publicado ? "publicado" : "pendente", url: dados.url, publicadoEm },
    });
    const status = await tx.publicacao.findMany({ where: { conteudoId: pub.conteudoId }, select: { status: true, publicadoEm: true } });
    const etapa = etapaAposPublicacoes(
      pub.conteudo.etapa,
      status.map((s) => s.status),
    );
    const ultima = status.reduce<Date | null>((m, s) => (s.publicadoEm && (!m || s.publicadoEm > m) ? s.publicadoEm : m), null);
    await tx.conteudo.update({
      where: { id: pub.conteudoId },
      data: { etapa, publicadoEm: etapa === "publicado" ? ultima : null },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "conteudo.publicacao_registrada",
        entidade: "Publicacao",
        entidadeId: publicacaoId,
        diff: { publicado: dados.publicado, url: dados.url },
      },
      tx,
    );
  });
}

type Metricas = {
  alcance: number | null;
  visualizacoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvamentos: number | null;
};

export async function salvarMetricas(ator: UsuarioAtual, publicacaoId: string, metricas: Metricas) {
  exigirUso(ator);
  const pub = await exigirPublicacao(publicacaoId);
  if (pub.status !== "publicado") throw new ErroNegocio("Marque como publicado antes de informar as métricas.");
  if (pub.metricasOrigem === "instagram") throw new ErroNegocio("Os números desta publicação vêm do Instagram.");
  await prisma.publicacao.update({ where: { id: publicacaoId }, data: { ...metricas, metricasEm: new Date() } });
}

export async function excluirConteudo(ator: UsuarioAtual, conteudoId: string) {
  exigirUso(ator);
  await exigirConteudo(conteudoId);
  await prisma.conteudo.update({ where: { id: conteudoId }, data: { excluidoEm: new Date() } });
}
