import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosLink, DadosOferta, DadosProduto, FiltrosProdutos, FormaPagamento } from "../esquemas/produto";
import { podeExcluirProduto } from "../regras/produto";
import { MENSAGEM_NAO_ENCONTRADO, exigirPermissaoComercial } from "./acesso";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Decimal não atravessa para componentes de cliente: vira "1234.56".
const texto = (d: Prisma.Decimal) => d.toFixed(2);

async function garantirSkuLivre(tx: Tx, sku: string | null, ignorarId?: string) {
  if (!sku) return;
  const existente = await tx.produto.findFirst({
    where: { sku, excluidoEm: null, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true },
  });
  if (existente) throw new ErroNegocio("Já existe um produto com este SKU.");
}

async function exigirProduto(tx: Tx, id: string) {
  const produto = await tx.produto.findFirst({ where: { id, excluidoEm: null }, select: { id: true } });
  if (!produto) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return produto;
}

export async function listarProdutos(ator: UsuarioAtual, filtros: FiltrosProdutos) {
  exigirPermissaoComercial(ator, "comercial:ver");
  const produtos = await prisma.produto.findMany({
    where: {
      excluidoEm: null,
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.area ? { area: filtros.area } : {}),
      ...(filtros.situacao === "ativos" ? { ativo: true } : filtros.situacao === "inativos" ? { ativo: false } : {}),
    },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      tipo: true,
      area: true,
      sku: true,
      ativo: true,
      ofertas: { where: { padrao: true }, select: { precoCheio: true }, take: 1 },
      _count: { select: { ofertas: true } },
    },
  });
  return produtos.map(({ ofertas, _count, ...p }) => ({
    ...p,
    precoPadrao: ofertas[0] ? texto(ofertas[0].precoCheio) : null,
    quantidadeOfertas: _count.ofertas,
  }));
}

/** Áreas já usadas, para o filtro da lista. */
export async function listarAreas() {
  const linhas = await prisma.produto.findMany({
    where: { excluidoEm: null, area: { not: null } },
    distinct: ["area"],
    orderBy: { area: "asc" },
    select: { area: true },
  });
  return linhas.map((l) => l.area!);
}

/** Produtos que podem ser escolhidos numa venda ou meta. */
export async function listarProdutosAtivos() {
  return prisma.produto.findMany({
    where: { excluidoEm: null, ativo: true },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, tipo: true },
  });
}

export async function obterProduto(ator: UsuarioAtual, id: string) {
  exigirPermissaoComercial(ator, "comercial:ver");
  const produto = await prisma.produto.findFirst({
    where: { id, excluidoEm: null },
    include: {
      ofertas: { orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] },
      links: { orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] },
    },
  });
  if (!produto) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return {
    ...produto,
    comissaoBase: texto(produto.comissaoBase),
    comissaoBonus: texto(produto.comissaoBonus),
    ofertas: produto.ofertas.map((o) => ({
      ...o,
      precoCheio: texto(o.precoCheio),
      matricula: texto(o.matricula),
      valorParcela: texto(o.valorParcela),
      descontoPontualidadePct: texto(o.descontoPontualidadePct),
      formasPagamento: (Array.isArray(o.formasPagamento) ? o.formasPagamento : []) as FormaPagamento[],
    })),
  };
}
export type ProdutoDetalhe = Awaited<ReturnType<typeof obterProduto>>;

export async function criarProduto(ator: UsuarioAtual, dados: DadosProduto) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  return prisma.$transaction(async (tx) => {
    await garantirSkuLivre(tx, dados.sku);
    return tx.produto.create({ data: dados, select: { id: true } });
  });
}

export async function editarProduto(ator: UsuarioAtual, id: string, dados: DadosProduto) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  await prisma.$transaction(async (tx) => {
    await exigirProduto(tx, id);
    await garantirSkuLivre(tx, dados.sku, id);
    await tx.produto.update({ where: { id }, data: dados });
  });
}

export async function definirAtivoProduto(ator: UsuarioAtual, id: string, ativo: boolean) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  await prisma.$transaction(async (tx) => {
    await exigirProduto(tx, id);
    await tx.produto.update({ where: { id }, data: { ativo } });
  });
}

export async function excluirProduto(ator: UsuarioAtual, id: string) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  await prisma.$transaction(async (tx) => {
    await exigirProduto(tx, id);
    // Vendas e metas entram nas entregas 2 e 3, que passam a contar aqui.
    if (!podeExcluirProduto({ vendas: 0, metas: 0 })) {
      throw new ErroNegocio("Este produto tem vendas ou metas. Desative em vez de excluir.");
    }
    await tx.produto.update({ where: { id }, data: { excluidoEm: new Date() } });
  });
}

export async function salvarOferta(ator: UsuarioAtual, produtoId: string, dados: DadosOferta & { id?: string }) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  const { id, ...campos } = dados;
  await prisma.$transaction(async (tx) => {
    await exigirProduto(tx, produtoId);
    const quantas = await tx.ofertaProduto.count({ where: { produtoId } });
    // A primeira oferta do produto é sempre a padrão.
    const padrao = campos.padrao || quantas === 0;
    let ofertaId = id;
    if (id) {
      const existe = await tx.ofertaProduto.findFirst({ where: { id, produtoId }, select: { id: true } });
      if (!existe) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
      await tx.ofertaProduto.update({ where: { id }, data: { ...campos, padrao } });
    } else {
      const maior = await tx.ofertaProduto.aggregate({ _max: { ordem: true }, where: { produtoId } });
      const nova = await tx.ofertaProduto.create({
        data: { ...campos, padrao, produtoId, ordem: (maior._max.ordem ?? 0) + 1 },
        select: { id: true },
      });
      ofertaId = nova.id;
    }
    if (padrao) {
      await tx.ofertaProduto.updateMany({ where: { produtoId, id: { not: ofertaId } }, data: { padrao: false } });
    }
  });
}

export async function excluirOferta(ator: UsuarioAtual, ofertaId: string) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  await prisma.$transaction(async (tx) => {
    const oferta = await tx.ofertaProduto.findFirst({
      where: { id: ofertaId, produto: { excluidoEm: null } },
      select: { produtoId: true, padrao: true },
    });
    if (!oferta) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
    await tx.ofertaProduto.delete({ where: { id: ofertaId } });
    // Sem a padrão, a primeira oferta restante assume.
    if (oferta.padrao) {
      const proxima = await tx.ofertaProduto.findFirst({ where: { produtoId: oferta.produtoId }, orderBy: { ordem: "asc" } });
      if (proxima) await tx.ofertaProduto.update({ where: { id: proxima.id }, data: { padrao: true } });
    }
  });
}

export async function salvarLink(ator: UsuarioAtual, produtoId: string, dados: DadosLink & { id?: string }) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  const { id, ...campos } = dados;
  await prisma.$transaction(async (tx) => {
    await exigirProduto(tx, produtoId);
    if (id) {
      const existe = await tx.linkProduto.findFirst({ where: { id, produtoId }, select: { id: true } });
      if (!existe) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
      await tx.linkProduto.update({ where: { id }, data: campos });
      return;
    }
    const maior = await tx.linkProduto.aggregate({ _max: { ordem: true }, where: { produtoId } });
    await tx.linkProduto.create({ data: { ...campos, produtoId, ordem: (maior._max.ordem ?? 0) + 1 } });
  });
}

export async function excluirLink(ator: UsuarioAtual, linkId: string) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  const link = await prisma.linkProduto.findFirst({ where: { id: linkId, produto: { excluidoEm: null } }, select: { id: true } });
  if (!link) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  await prisma.linkProduto.delete({ where: { id: linkId } });
}
