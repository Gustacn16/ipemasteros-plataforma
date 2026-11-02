import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { intervaloDoPeriodo } from "@/modulos/tarefas/regras/relatorio";
import type { DadosVenda, FiltrosVendas } from "../esquemas/venda";
import { podeEditarVenda, valorTotal, vendedorPermitido } from "../regras/venda";
import { MENSAGEM_NAO_ENCONTRADO, exigirPermissaoComercial } from "./acesso";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Colunas @db.Date: "AAAA-MM-DD" ↔ meia-noite UTC do dia.
const paraData = (dia: string) => new Date(`${dia}T00:00:00Z`);
const paraDia = (data: Date) => data.toISOString().slice(0, 10);
const diaOuNulo = (data: Date | null) => (data ? paraDia(data) : null);
const comparavel = (v: unknown) => (v instanceof Date ? paraDia(v) : String(v));

const PAPEIS_VENDEDOR = ["comercial", "gestor", "admin"] as const;

/** Quem pode ser vendedor de uma venda ou meta (regra 5). */
export async function listarVendedores() {
  return prisma.usuario.findMany({
    where: { ativo: true, papel: { in: [...PAPEIS_VENDEDOR] } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

const selecaoVenda = {
  id: true,
  produtoId: true,
  ofertaId: true,
  vendedorId: true,
  dataVenda: true,
  dataEntradaLead: true,
  nomeCliente: true,
  whatsappCliente: true,
  canalId: true,
  dataEntrega: true,
  metodoPagamento: true,
  entrada: true,
  numeroParcelas: true,
  valorParcela: true,
  primeiroVencimento: true,
  valorTotal: true,
  observacoes: true,
  criadoEm: true,
  produto: { select: { nome: true } },
  oferta: { select: { nome: true } },
  vendedor: { select: { nome: true } },
  canal: { select: { nome: true } },
} satisfies Prisma.VendaSelect;

export async function listarVendas(ator: UsuarioAtual, filtros: FiltrosVendas) {
  exigirPermissaoComercial(ator, "comercial:ver");
  const agora = new Date();
  const intervalo = intervaloDoPeriodo(filtros, agora);
  const equipe = temPermissao(ator.papel, "comercial:ver_equipe");

  const vendas = await prisma.venda.findMany({
    where: {
      excluidoEm: null,
      dataVenda: { gte: paraData(intervalo.primeiroDia), lte: paraData(intervalo.ultimoDia) },
      // Sem a visão da equipe, só as vendas do próprio vendedor.
      vendedorId: equipe ? filtros.vendedor || undefined : ator.id,
      ...(filtros.produto ? { produtoId: filtros.produto } : {}),
      ...(filtros.canal ? { canalId: filtros.canal } : {}),
    },
    orderBy: [{ dataVenda: "desc" }, { criadoEm: "desc" }],
    select: selecaoVenda,
  });

  const linhas = vendas.map(({ criadoEm, produto, oferta, vendedor, canal, ...v }) => ({
    ...v,
    dataVenda: paraDia(v.dataVenda),
    dataEntradaLead: diaOuNulo(v.dataEntradaLead),
    dataEntrega: diaOuNulo(v.dataEntrega),
    primeiroVencimento: diaOuNulo(v.primeiroVencimento),
    entrada: v.entrada.toFixed(2),
    valorParcela: v.valorParcela.toFixed(2),
    valorTotal: v.valorTotal.toFixed(2),
    produtoNome: produto.nome,
    ofertaNome: oferta?.nome ?? null,
    vendedorNome: vendedor.nome,
    canalNome: canal?.nome ?? null,
    podeEditar: podeEditarVenda(ator, { vendedorId: v.vendedorId, criadoEm }, agora),
  }));
  const totalCentavos = vendas.reduce((soma, v) => soma + Math.round(Number(v.valorTotal) * 100), 0);
  return { vendas: linhas, total: (totalCentavos / 100).toFixed(2), intervalo, equipe };
}
export type LinhaVenda = Awaited<ReturnType<typeof listarVendas>>["vendas"][number];

/** Confere produto, oferta, canal e vendedor contra o banco. Na edição, mantém valendo o que já estava gravado. */
async function validarReferencias(tx: Tx, dados: DadosVenda, atual?: { produtoId: string; canalId: string | null; vendedorId: string }) {
  const produto = await tx.produto.findFirst({ where: { id: dados.produtoId }, select: { ativo: true, excluidoEm: true } });
  const mesmoProduto = atual?.produtoId === dados.produtoId;
  if (!produto || (!mesmoProduto && (!produto.ativo || produto.excluidoEm))) throw new ErroNegocio("Produto indisponível.");

  if (dados.ofertaId) {
    const oferta = await tx.ofertaProduto.findFirst({ where: { id: dados.ofertaId, produtoId: dados.produtoId }, select: { id: true } });
    if (!oferta) throw new ErroNegocio("Oferta não pertence ao produto.");
  }

  if (dados.canalId && dados.canalId !== atual?.canalId) {
    const canal = await tx.canalVenda.findFirst({ where: { id: dados.canalId, ativo: true }, select: { id: true } });
    if (!canal) throw new ErroNegocio("Canal indisponível.");
  }

  const vendedor = await tx.usuario.findFirst({
    // Vendedor que saiu continua valendo nas vendas antigas, se não for trocado.
    where:
      dados.vendedorId === atual?.vendedorId
        ? { id: dados.vendedorId }
        : { id: dados.vendedorId, ativo: true, papel: { in: [...PAPEIS_VENDEDOR] } },
    select: { id: true },
  });
  if (!vendedor) throw new ErroNegocio("Vendedor inválido.");
}

function camposDaVenda(dados: DadosVenda) {
  return {
    produtoId: dados.produtoId,
    ofertaId: dados.ofertaId,
    vendedorId: dados.vendedorId,
    dataVenda: paraData(dados.dataVenda),
    dataEntradaLead: dados.dataEntradaLead ? paraData(dados.dataEntradaLead) : null,
    nomeCliente: dados.nomeCliente,
    whatsappCliente: dados.whatsappCliente,
    canalId: dados.canalId,
    dataEntrega: dados.dataEntrega ? paraData(dados.dataEntrega) : null,
    metodoPagamento: dados.metodoPagamento,
    entrada: dados.entrada,
    numeroParcelas: dados.numeroParcelas,
    valorParcela: dados.valorParcela,
    primeiroVencimento: dados.primeiroVencimento ? paraData(dados.primeiroVencimento) : null,
    // Regra 1: o total é sempre calculado aqui, nunca o enviado pela tela.
    valorTotal: valorTotal(dados.entrada, dados.numeroParcelas, dados.valorParcela),
    observacoes: dados.observacoes,
  };
}

export async function criarVenda(ator: UsuarioAtual, dados: DadosVenda) {
  exigirPermissaoComercial(ator, "comercial:registrar_venda");
  if (!vendedorPermitido(ator, dados.vendedorId)) throw new ErroPermissao("comercial:gerenciar_vendas");
  return prisma.$transaction(async (tx) => {
    await validarReferencias(tx, dados);
    const campos = camposDaVenda(dados);
    const venda = await tx.venda.create({ data: { ...campos, criadoPorId: ator.id }, select: { id: true } });
    // Sem nome nem WhatsApp do cliente no log.
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "venda.criada", entidade: "Venda", entidadeId: venda.id, diff: { valorTotal: campos.valorTotal } },
      tx,
    );
    return venda;
  });
}

async function exigirVendaEditavel(tx: Tx, ator: UsuarioAtual, id: string) {
  const venda = await tx.venda.findFirst({ where: { id, excluidoEm: null }, select: selecaoVenda });
  const equipe = temPermissao(ator.papel, "comercial:ver_equipe");
  if (!venda || (!equipe && venda.vendedorId !== ator.id)) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  if (!podeEditarVenda(ator, venda, new Date())) throw new ErroPermissao("comercial:gerenciar_vendas");
  return venda;
}

export async function editarVenda(ator: UsuarioAtual, id: string, dados: DadosVenda) {
  exigirPermissaoComercial(ator, "comercial:registrar_venda");
  if (!vendedorPermitido(ator, dados.vendedorId)) throw new ErroPermissao("comercial:gerenciar_vendas");
  await prisma.$transaction(async (tx) => {
    const atual = await exigirVendaEditavel(tx, ator, id);
    await validarReferencias(tx, dados, atual);
    const campos = camposDaVenda(dados);
    // Só os nomes dos campos alterados, nunca os valores pessoais.
    const antes = camposDaVenda({
      ...dados,
      ...atual,
      dataVenda: paraDia(atual.dataVenda),
      dataEntradaLead: diaOuNulo(atual.dataEntradaLead),
      dataEntrega: diaOuNulo(atual.dataEntrega),
      primeiroVencimento: diaOuNulo(atual.primeiroVencimento),
      entrada: atual.entrada.toFixed(2),
      valorParcela: atual.valorParcela.toFixed(2),
    });
    const alterados = (Object.keys(campos) as (keyof typeof campos)[]).filter((k) => comparavel(campos[k]) !== comparavel(antes[k]));
    await tx.venda.update({ where: { id }, data: campos });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "venda.editada",
        entidade: "Venda",
        entidadeId: id,
        diff: { campos: alterados, valorTotal: campos.valorTotal },
      },
      tx,
    );
  });
}

export async function excluirVenda(ator: UsuarioAtual, id: string) {
  exigirPermissaoComercial(ator, "comercial:registrar_venda");
  await prisma.$transaction(async (tx) => {
    const venda = await exigirVendaEditavel(tx, ator, id);
    await tx.venda.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "venda.excluida", entidade: "Venda", entidadeId: id, diff: { valorTotal: venda.valorTotal.toFixed(2) } },
      tx,
    );
  });
}
