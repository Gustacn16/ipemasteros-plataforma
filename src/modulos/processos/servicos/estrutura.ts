import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosArea, DadosCategoria, IconeCategoria, TipoDocumento } from "../esquemas/processos";
import { exigir, podeEditar } from "./acesso";
import { ESTRUTURA_INICIAL } from "./estrutura-inicial";

export type DocumentoNaArvore = { id: string; titulo: string; tipo: TipoDocumento; publicado: boolean; pendente: boolean };
export type AreaNaArvore = { id: string; nome: string; descricao: string | null; documentos: DocumentoNaArvore[] };
export type CategoriaNaArvore = { id: string; nome: string; descricao: string | null; icone: IconeCategoria; areas: AreaNaArvore[] };

/** Categoria → Área → Documento. Quem só lê vê só documentos publicados, com o título publicado. */
export async function obterArvore(ator: UsuarioAtual): Promise<CategoriaNaArvore[]> {
  exigir(ator, "processos:ver");
  const editor = podeEditar(ator);
  const categorias = await prisma.categoriaProcesso.findMany({
    where: { excluidoEm: null },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      descricao: true,
      icone: true,
      areas: {
        where: { excluidoEm: null },
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          descricao: true,
          documentos: {
            where: { excluidoEm: null, ...(editor ? {} : { versaoPublicada: { gt: 0 } }) },
            orderBy: [{ ordem: "asc" }, { titulo: "asc" }],
            select: { id: true, titulo: true, tituloPublicado: true, tipo: true, versaoPublicada: true, alteradoAposPublicar: true },
          },
        },
      },
    },
  });
  return categorias.map((c) => ({
    ...c,
    icone: c.icone as IconeCategoria,
    areas: c.areas.map((a) => ({
      ...a,
      documentos: a.documentos
        .map((d) => ({
          id: d.id,
          titulo: editor ? d.titulo : (d.tituloPublicado ?? d.titulo),
          tipo: d.tipo,
          publicado: d.versaoPublicada > 0,
          pendente: editor && d.alteradoAposPublicar,
        }))
        .sort((x, y) => x.titulo.localeCompare(y.titulo, "pt-BR")),
    })),
  }));
}

export async function listarOpcoesArea() {
  const areas = await prisma.areaProcesso.findMany({
    where: { excluidoEm: null, categoria: { excluidoEm: null } },
    orderBy: [{ categoria: { ordem: "asc" } }, { categoria: { nome: "asc" } }, { ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, categoria: { select: { nome: true } } },
  });
  return areas.map((a) => ({ valor: a.id, rotulo: `${a.categoria.nome} · ${a.nome}` }));
}

/** Pessoas do time interno, para dono do processo e responsável do indicador. */
export async function listarOpcoesPessoas() {
  const pessoas = await prisma.usuario.findMany({
    where: { ativo: true, papel: { in: ["admin", "gestor", "colaborador", "comercial"] } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  return pessoas.map((p) => ({ valor: p.id, rotulo: p.nome }));
}

// ─── Categorias ─────────────────────────────────────────────────────────────

export async function criarCategoria(ator: UsuarioAtual, dados: DadosCategoria) {
  exigir(ator, "processos:editar");
  const ultima = await prisma.categoriaProcesso.aggregate({ where: { excluidoEm: null }, _max: { ordem: true } });
  return prisma.categoriaProcesso.create({ data: { ...dados, ordem: (ultima._max.ordem ?? 0) + 1 }, select: { id: true } });
}

export async function editarCategoria(ator: UsuarioAtual, id: string, dados: DadosCategoria) {
  exigir(ator, "processos:editar");
  const r = await prisma.categoriaProcesso.updateMany({ where: { id, excluidoEm: null }, data: dados });
  if (r.count === 0) throw new ErroNegocio("Categoria não encontrada.");
}

export async function excluirCategoria(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:editar");
  await prisma.$transaction(async (tx) => {
    const cat = await tx.categoriaProcesso.findFirst({
      where: { id, excluidoEm: null },
      select: { nome: true, _count: { select: { areas: { where: { excluidoEm: null } } } } },
    });
    if (!cat) throw new ErroNegocio("Categoria não encontrada.");
    if (cat._count.areas > 0) throw new ErroNegocio("Exclua ou mova as áreas desta categoria antes.");
    await tx.categoriaProcesso.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.categoria_excluida", entidade: "CategoriaProcesso", entidadeId: id, diff: { nome: cat.nome } },
      tx,
    );
  });
}

/** Troca a ordem com a vizinha de cima ou de baixo. */
export async function moverCategoria(ator: UsuarioAtual, id: string, direcao: "subir" | "descer") {
  exigir(ator, "processos:editar");
  const todas = await prisma.categoriaProcesso.findMany({
    where: { excluidoEm: null },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true },
  });
  await trocarOrdem(todas, id, direcao, (itemId, ordem) => prisma.categoriaProcesso.update({ where: { id: itemId }, data: { ordem } }));
}

// ─── Áreas ──────────────────────────────────────────────────────────────────

async function garantirCategoria(categoriaId: string) {
  const c = await prisma.categoriaProcesso.findFirst({ where: { id: categoriaId, excluidoEm: null }, select: { id: true } });
  if (!c) throw new ErroNegocio("Categoria não encontrada.");
}

export async function criarArea(ator: UsuarioAtual, dados: DadosArea) {
  exigir(ator, "processos:editar");
  await garantirCategoria(dados.categoriaId);
  const ultima = await prisma.areaProcesso.aggregate({ where: { categoriaId: dados.categoriaId, excluidoEm: null }, _max: { ordem: true } });
  return prisma.areaProcesso.create({ data: { ...dados, ordem: (ultima._max.ordem ?? 0) + 1 }, select: { id: true } });
}

export async function editarArea(ator: UsuarioAtual, id: string, dados: DadosArea) {
  exigir(ator, "processos:editar");
  await garantirCategoria(dados.categoriaId);
  const r = await prisma.areaProcesso.updateMany({ where: { id, excluidoEm: null }, data: dados });
  if (r.count === 0) throw new ErroNegocio("Área não encontrada.");
}

export async function excluirArea(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:editar");
  await prisma.$transaction(async (tx) => {
    const area = await tx.areaProcesso.findFirst({
      where: { id, excluidoEm: null },
      select: { nome: true, _count: { select: { documentos: { where: { excluidoEm: null } } } } },
    });
    if (!area) throw new ErroNegocio("Área não encontrada.");
    if (area._count.documentos > 0) throw new ErroNegocio("Exclua ou mova os documentos desta área antes.");
    await tx.areaProcesso.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.area_excluida", entidade: "AreaProcesso", entidadeId: id, diff: { nome: area.nome } },
      tx,
    );
  });
}

export async function moverArea(ator: UsuarioAtual, id: string, direcao: "subir" | "descer") {
  exigir(ator, "processos:editar");
  const area = await prisma.areaProcesso.findFirst({ where: { id, excluidoEm: null }, select: { categoriaId: true } });
  if (!area) throw new ErroNegocio("Área não encontrada.");
  const todas = await prisma.areaProcesso.findMany({
    where: { categoriaId: area.categoriaId, excluidoEm: null },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true },
  });
  await trocarOrdem(todas, id, direcao, (itemId, ordem) => prisma.areaProcesso.update({ where: { id: itemId }, data: { ordem } }));
}

async function trocarOrdem(
  itens: { id: string }[],
  id: string,
  direcao: "subir" | "descer",
  gravar: (id: string, ordem: number) => Prisma.PrismaPromise<unknown>,
) {
  const i = itens.findIndex((x) => x.id === id);
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= itens.length) return;
  const nova = [...itens];
  [nova[i], nova[j]] = [nova[j]!, nova[i]!];
  // Renumera tudo (a ordem antiga pode ter empates).
  await prisma.$transaction(nova.map((item, k) => gravar(item.id, k + 1)));
}

// ─── Estrutura inicial ──────────────────────────────────────────────────────

/** Cria categorias, áreas e rascunhos sugeridos. Só funciona com a área vazia. */
export async function criarEstruturaInicial(ator: UsuarioAtual) {
  exigir(ator, "processos:editar");
  await prisma.$transaction(async (tx) => {
    const existentes = await tx.categoriaProcesso.count({ where: { excluidoEm: null } });
    if (existentes > 0) throw new ErroNegocio("A estrutura já existe. Use Organizar para ajustar.");
    for (const [ci, cat] of ESTRUTURA_INICIAL.entries()) {
      const categoria = await tx.categoriaProcesso.create({
        data: { nome: cat.nome, descricao: cat.descricao, icone: cat.icone, ordem: ci + 1 },
        select: { id: true },
      });
      for (const [ai, ar] of cat.areas.entries()) {
        const area = await tx.areaProcesso.create({
          data: { categoriaId: categoria.id, nome: ar.nome, descricao: ar.descricao, ordem: ai + 1 },
          select: { id: true },
        });
        for (const doc of ar.documentos) {
          const criado = await tx.documentoProcesso.create({
            data: {
              areaId: area.id,
              tipo: doc.tipo,
              titulo: doc.titulo,
              resumo: doc.resumo,
              conteudo: doc.conteudo,
              objetivo: doc.objetivo ?? null,
              entradas: doc.entradas ?? null,
              saidas: doc.saidas ?? null,
              clientes: doc.clientes ?? null,
              fornecedores: doc.fornecedores ?? null,
              frequencia: doc.frequencia ?? null,
              fluxo: doc.fluxo ?? [],
              revisarACadaMeses: doc.revisarACadaMeses ?? null,
              criadoPorId: ator.id,
              atualizadoPorId: ator.id,
            },
            select: { id: true },
          });
          for (const [ii, ind] of (doc.indicadores ?? []).entries()) {
            await tx.indicadorProcesso.create({ data: { ...ind, documentoId: criado.id, ordem: ii + 1 } });
          }
        }
      }
    }
  }, { timeout: 30_000 });
}
