import "server-only";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { TIPOS_DOCUMENTO, type DadosDocumento, type DadosNovoDocumento, type TipoDocumento } from "../esquemas/processos";
import { casaBusca, trechoDaBusca } from "../regras/busca";
import { esquemaFluxo, lerFluxo, textoDoFluxo, type Etapa } from "../regras/fluxo";
import { chaveTitulo, extrairLigacoes, substituirLigacoes } from "../regras/ligacoes";
import { proximaRevisao, revisaoVencida } from "../regras/revisao";
import { MENSAGEM_NAO_ENCONTRADO, exigir, podeEditar } from "./acesso";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ─── Snapshot da versão publicada ───────────────────────────────────────────

const textoNulo = z.string().nullable().catch(null);
const esquemaDadosVersao = z.object({
  tipo: z.enum(TIPOS_DOCUMENTO).catch("processo"),
  titulo: z.string().catch("Sem título"),
  resumo: textoNulo,
  conteudo: textoNulo,
  objetivo: textoNulo,
  donoId: textoNulo,
  donoNome: textoNulo,
  fornecedores: textoNulo,
  entradas: textoNulo,
  saidas: textoNulo,
  clientes: textoNulo,
  frequencia: textoNulo,
  revisarACadaMeses: z.number().nullable().catch(null),
  fluxo: z.unknown(),
});
export type DadosVersao = Omit<z.infer<typeof esquemaDadosVersao>, "fluxo"> & { fluxo: Etapa[] };

function lerDadosVersao(json: unknown): DadosVersao {
  const d = esquemaDadosVersao.parse(json ?? {});
  return { ...d, fluxo: lerFluxo(d.fluxo) };
}

const selecaoCopia = {
  id: true,
  areaId: true,
  tipo: true,
  titulo: true,
  resumo: true,
  conteudo: true,
  objetivo: true,
  donoId: true,
  fornecedores: true,
  entradas: true,
  saidas: true,
  clientes: true,
  frequencia: true,
  fluxo: true,
  revisarACadaMeses: true,
  versaoPublicada: true,
  publicadoEm: true,
  alteradoAposPublicar: true,
  atualizadoEm: true,
  dono: { select: { nome: true } },
  atualizadoPor: { select: { nome: true } },
  area: { select: { id: true, nome: true, categoria: { select: { id: true, nome: true } } } },
} as const;

type Copia = NonNullable<Awaited<ReturnType<typeof buscarCopia>>>;
const buscarCopia = (id: string, cliente: Tx | typeof prisma = prisma) =>
  cliente.documentoProcesso.findFirst({ where: { id, excluidoEm: null }, select: selecaoCopia });

function dadosDaCopia(d: Copia): DadosVersao {
  return {
    tipo: d.tipo,
    titulo: d.titulo,
    resumo: d.resumo,
    conteudo: d.conteudo,
    objetivo: d.objetivo,
    donoId: d.donoId,
    donoNome: d.dono?.nome ?? null,
    fornecedores: d.fornecedores,
    entradas: d.entradas,
    saidas: d.saidas,
    clientes: d.clientes,
    frequencia: d.frequencia,
    revisarACadaMeses: d.revisarACadaMeses,
    fluxo: lerFluxo(d.fluxo),
  };
}

async function ultimaVersao(documentoId: string, numero: number) {
  if (numero <= 0) return null;
  return prisma.versaoDocumentoProcesso.findUnique({
    where: { documentoId_numero: { documentoId, numero } },
    select: { numero: true, nota: true, dados: true, criadoEm: true, publicadoPor: { select: { nome: true } } },
  });
}

// ─── Links entre documentos ─────────────────────────────────────────────────

/** Mapa título (sem acento/caixa) → id, só com documentos que o ator pode abrir. */
async function mapaDeTitulos(ator: UsuarioAtual, cliente: Tx | typeof prisma = prisma) {
  const editor = podeEditar(ator);
  const docs = await cliente.documentoProcesso.findMany({
    where: { excluidoEm: null, ...(editor ? {} : { versaoPublicada: { gt: 0 } }) },
    select: { id: true, titulo: true, tituloPublicado: true },
  });
  const mapa = new Map<string, string>();
  for (const d of docs) {
    if (d.tituloPublicado) mapa.set(chaveTitulo(d.tituloPublicado), d.id);
    if (editor || !d.tituloPublicado) mapa.set(chaveTitulo(d.titulo), d.id);
  }
  return mapa;
}

// ─── Leitura ────────────────────────────────────────────────────────────────

export async function obterDocumento(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:ver");
  const editor = podeEditar(ator);
  const copia = await buscarCopia(id);
  if (!copia || (!editor && copia.versaoPublicada === 0)) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);

  const versao = await ultimaVersao(id, copia.versaoPublicada);
  // Quem edita lê a cópia de trabalho; quem só lê, a última versão publicada.
  const dados = editor || !versao ? dadosDaCopia(copia) : lerDadosVersao(versao.dados);

  const [mapa, citadoPor] = await Promise.all([
    mapaDeTitulos(ator),
    prisma.ligacaoDocumentoProcesso.findMany({
      where: { destinoId: id, origem: { excluidoEm: null, ...(editor ? {} : { versaoPublicada: { gt: 0 } }) } },
      select: { origem: { select: { id: true, titulo: true, tituloPublicado: true } } },
    }),
  ]);
  const conteudo = dados.conteudo ? substituirLigacoes(dados.conteudo, (t) => mapa.get(chaveTitulo(t)) ?? null) : null;
  const proxima = proximaRevisao(copia.publicadoEm, dados.revisarACadaMeses);

  return {
    id: copia.id,
    area: copia.area,
    ...dados,
    conteudo,
    versaoPublicada: copia.versaoPublicada,
    publicadoEm: copia.publicadoEm,
    ultimaPublicacao: versao ? { nota: versao.nota, por: versao.publicadoPor.nome, em: versao.criadoEm } : null,
    mostrandoRascunho: editor && copia.alteradoAposPublicar,
    atualizadoEm: copia.atualizadoEm,
    atualizadoPor: copia.atualizadoPor.nome,
    proximaRevisao: proxima,
    revisaoVencida: revisaoVencida(copia.publicadoEm, dados.revisarACadaMeses, new Date()),
    citadoPor: citadoPor
      .map((c) => ({ id: c.origem.id, titulo: editor ? c.origem.titulo : (c.origem.tituloPublicado ?? c.origem.titulo) }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
  };
}
export type DocumentoLeitura = Awaited<ReturnType<typeof obterDocumento>>;

export async function obterDocumentoParaEditar(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:editar");
  const copia = await buscarCopia(id);
  if (!copia) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  const titulos = await prisma.documentoProcesso.findMany({
    where: { excluidoEm: null, id: { not: id } },
    orderBy: { titulo: "asc" },
    select: { titulo: true },
  });
  return { ...dadosDaCopia(copia), id: copia.id, areaId: copia.areaId, area: copia.area, versaoPublicada: copia.versaoPublicada, alteradoAposPublicar: copia.alteradoAposPublicar, outrosTitulos: titulos.map((t) => t.titulo) };
}
export type DocumentoEdicao = Awaited<ReturnType<typeof obterDocumentoParaEditar>>;

export async function listarVersoes(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:ver");
  const doc = await prisma.documentoProcesso.findFirst({
    where: { id, excluidoEm: null },
    select: { id: true, titulo: true, tituloPublicado: true, versaoPublicada: true },
  });
  if (!doc || (!podeEditar(ator) && doc.versaoPublicada === 0)) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  const versoes = await prisma.versaoDocumentoProcesso.findMany({
    where: { documentoId: id },
    orderBy: { numero: "desc" },
    select: { numero: true, nota: true, criadoEm: true, publicadoPor: { select: { nome: true } } },
  });
  return { titulo: podeEditar(ator) ? doc.titulo : (doc.tituloPublicado ?? doc.titulo), versaoPublicada: doc.versaoPublicada, versoes };
}

export async function obterVersao(ator: UsuarioAtual, id: string, numero: number) {
  exigir(ator, "processos:ver");
  const doc = await prisma.documentoProcesso.findFirst({ where: { id, excluidoEm: null }, select: { versaoPublicada: true } });
  if (!doc || (!podeEditar(ator) && doc.versaoPublicada === 0)) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  const versao = await prisma.versaoDocumentoProcesso.findUnique({
    where: { documentoId_numero: { documentoId: id, numero } },
    select: { numero: true, nota: true, dados: true, criadoEm: true, publicadoPor: { select: { nome: true } } },
  });
  if (!versao) throw new ErroNegocio("Versão não encontrada.");
  const dados = lerDadosVersao(versao.dados);
  const mapa = await mapaDeTitulos(ator);
  return {
    ...versao,
    dados: { ...dados, conteudo: dados.conteudo ? substituirLigacoes(dados.conteudo, (t) => mapa.get(chaveTitulo(t)) ?? null) : null },
    atual: versao.numero === doc.versaoPublicada,
  };
}

// ─── Visão geral e busca ────────────────────────────────────────────────────

export async function buscarDocumentos(ator: UsuarioAtual, termo: string) {
  exigir(ator, "processos:ver");
  const editor = podeEditar(ator);
  const docs = await prisma.documentoProcesso.findMany({
    where: { excluidoEm: null, ...(editor ? {} : { versaoPublicada: { gt: 0 } }) },
    select: {
      ...selecaoCopia,
      tituloPublicado: true,
      versoes: { orderBy: { numero: "desc" }, take: 1, select: { dados: true } },
    },
  });
  const resultados: { id: string; titulo: string; tipo: TipoDocumento; caminho: string; trecho: string | null }[] = [];
  for (const d of docs) {
    const dados = editor || !d.versoes[0] ? dadosDaCopia(d) : lerDadosVersao(d.versoes[0].dados);
    const corpo = [dados.resumo, dados.conteudo, dados.objetivo, dados.entradas, dados.saidas, dados.clientes, dados.fornecedores, textoDoFluxo(dados.fluxo)]
      .filter(Boolean)
      .join(" \n ");
    if (!casaBusca(`${dados.titulo} ${corpo}`, termo)) continue;
    resultados.push({
      id: d.id,
      titulo: dados.titulo,
      tipo: dados.tipo,
      caminho: `${d.area.categoria.nome} · ${d.area.nome}`,
      trecho: trechoDaBusca(corpo, termo) ?? dados.resumo,
    });
  }
  // Título que casa vem primeiro.
  return resultados.sort((a, b) => Number(casaBusca(b.titulo, termo)) - Number(casaBusca(a.titulo, termo)) || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/** Resumos para os cartões da visão geral e a lista "Para revisar". */
export async function obterResumos(ator: UsuarioAtual) {
  exigir(ator, "processos:ver");
  const editor = podeEditar(ator);
  const docs = await prisma.documentoProcesso.findMany({
    where: { excluidoEm: null, ...(editor ? {} : { versaoPublicada: { gt: 0 } }) },
    select: {
      id: true,
      titulo: true,
      tituloPublicado: true,
      resumo: true,
      resumoPublicado: true,
      publicadoEm: true,
      atualizadoEm: true,
      revisarACadaMeses: true,
      versaoPublicada: true,
      area: { select: { nome: true, categoria: { select: { nome: true } } } },
    },
  });
  const agora = new Date();
  const resumos = new Map(docs.map((d) => [d.id, editor ? d.resumo : d.resumoPublicado]));
  const paraRevisar = docs
    .filter((d) => revisaoVencida(d.publicadoEm, d.revisarACadaMeses, agora))
    .map((d) => ({ id: d.id, titulo: editor ? d.titulo : (d.tituloPublicado ?? d.titulo), venceuEm: proximaRevisao(d.publicadoEm, d.revisarACadaMeses)! }));
  const rascunhos = editor ? docs.filter((d) => d.versaoPublicada === 0).length : 0;
  // Quem edita vê o que mudou no rascunho; quem lê, o que foi publicado.
  const quando = (d: (typeof docs)[number]) => (editor ? d.atualizadoEm : (d.publicadoEm ?? d.atualizadoEm));
  const recentes = [...docs]
    .sort((a, b) => quando(b).getTime() - quando(a).getTime())
    .slice(0, 6)
    .map((d) => ({
      id: d.id,
      titulo: editor ? d.titulo : (d.tituloPublicado ?? d.titulo),
      caminho: `${d.area.categoria.nome} · ${d.area.nome}`,
      em: quando(d),
      rascunho: d.versaoPublicada === 0,
    }));
  return { resumos, paraRevisar, rascunhos, recentes, total: docs.length };
}

// ─── Escrita ────────────────────────────────────────────────────────────────

async function garantirArea(areaId: string, cliente: Tx | typeof prisma = prisma) {
  const a = await cliente.areaProcesso.findFirst({ where: { id: areaId, excluidoEm: null, categoria: { excluidoEm: null } }, select: { id: true } });
  if (!a) throw new ErroNegocio("Área não encontrada.");
}

async function garantirPessoa(usuarioId: string | null) {
  if (!usuarioId) return;
  const u = await prisma.usuario.findFirst({ where: { id: usuarioId, ativo: true }, select: { id: true } });
  if (!u) throw new ErroNegocio("Pessoa não encontrada.");
}
export { garantirPessoa };

export async function criarDocumento(ator: UsuarioAtual, dados: DadosNovoDocumento) {
  exigir(ator, "processos:editar");
  await garantirArea(dados.areaId);
  return prisma.documentoProcesso.create({
    data: { ...dados, fluxo: [], criadoPorId: ator.id, atualizadoPorId: ator.id },
    select: { id: true },
  });
}

export async function salvarDocumento(ator: UsuarioAtual, id: string, dados: DadosDocumento, fluxo: Etapa[]) {
  exigir(ator, "processos:editar");
  await garantirArea(dados.areaId);
  await garantirPessoa(dados.donoId);
  const r = await prisma.documentoProcesso.updateMany({
    where: { id, excluidoEm: null },
    data: { ...dados, fluxo: esquemaFluxo.parse(fluxo), alteradoAposPublicar: true, atualizadoPorId: ator.id },
  });
  if (r.count === 0) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
}

async function recalcularLigacoes(tx: Tx, ator: UsuarioAtual, id: string, conteudo: string | null) {
  const titulos = extrairLigacoes(conteudo);
  await tx.ligacaoDocumentoProcesso.deleteMany({ where: { origemId: id } });
  if (titulos.length === 0) return;
  const mapa = await mapaDeTitulos({ ...ator, papel: "admin" }, tx);
  const destinos = [...new Set(titulos.map((t) => mapa.get(chaveTitulo(t))).filter((d): d is string => !!d && d !== id))];
  if (destinos.length) await tx.ligacaoDocumentoProcesso.createMany({ data: destinos.map((destinoId) => ({ origemId: id, destinoId })) });
}

export async function publicarDocumento(ator: UsuarioAtual, id: string, nota: string) {
  exigir(ator, "processos:editar");
  return prisma.$transaction(async (tx) => {
    const copia = await buscarCopia(id, tx);
    if (!copia) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    const dados = dadosDaCopia(copia);
    const numero = copia.versaoPublicada + 1;
    await tx.versaoDocumentoProcesso.create({
      data: { documentoId: id, numero, nota, dados: { ...dados, fluxo: dados.fluxo }, publicadoPorId: ator.id },
    });
    await tx.documentoProcesso.update({
      where: { id },
      data: {
        versaoPublicada: numero,
        publicadoEm: new Date(),
        tituloPublicado: dados.titulo,
        resumoPublicado: dados.resumo,
        alteradoAposPublicar: false,
      },
    });
    await recalcularLigacoes(tx, ator, id, dados.conteudo);
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.documento_publicado", entidade: "DocumentoProcesso", entidadeId: id, diff: { versao: numero, titulo: dados.titulo } },
      tx,
    );
    return { numero };
  });
}

/** Copia uma versão antiga para a cópia de trabalho (vira rascunho até publicar de novo). */
export async function restaurarVersao(ator: UsuarioAtual, id: string, numero: number) {
  exigir(ator, "processos:editar");
  await prisma.$transaction(async (tx) => {
    const versao = await tx.versaoDocumentoProcesso.findUnique({
      where: { documentoId_numero: { documentoId: id, numero } },
      select: { dados: true, documento: { select: { excluidoEm: true } } },
    });
    if (!versao || versao.documento.excluidoEm) throw new ErroNegocio("Versão não encontrada.");
    const d = lerDadosVersao(versao.dados);
    const dono = d.donoId ? await tx.usuario.findFirst({ where: { id: d.donoId, ativo: true }, select: { id: true } }) : null;
    await tx.documentoProcesso.update({
      where: { id },
      data: {
        tipo: d.tipo,
        titulo: d.titulo,
        resumo: d.resumo,
        conteudo: d.conteudo,
        objetivo: d.objetivo,
        donoId: dono?.id ?? null,
        fornecedores: d.fornecedores,
        entradas: d.entradas,
        saidas: d.saidas,
        clientes: d.clientes,
        frequencia: d.frequencia,
        revisarACadaMeses: d.revisarACadaMeses,
        fluxo: d.fluxo,
        alteradoAposPublicar: true,
        atualizadoPorId: ator.id,
      },
    });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.versao_restaurada", entidade: "DocumentoProcesso", entidadeId: id, diff: { versao: numero } },
      tx,
    );
  });
}

export async function excluirDocumento(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:editar");
  await prisma.$transaction(async (tx) => {
    const doc = await tx.documentoProcesso.findFirst({ where: { id, excluidoEm: null }, select: { titulo: true } });
    if (!doc) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    await tx.documentoProcesso.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.documento_excluido", entidade: "DocumentoProcesso", entidadeId: id, diff: { titulo: doc.titulo } },
      tx,
    );
  });
}
