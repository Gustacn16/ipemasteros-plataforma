import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { FiltrosDashboard } from "../esquemas/dashboard";
import { mesesDaJanela, percentualMeta, ticketMedio, variacao } from "../regras/dashboard";
import { mesAnterior, mesSeguinte, primeiroDiaDoMes } from "../regras/meta";
import { exigirPermissaoComercial } from "./acesso";

const MESES_DA_SERIE = 12;

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const centavos = (v: { toString(): string } | null | undefined) => Math.round(Number(v ?? 0) * 100);
const reais = (c: number) => (c / 100).toFixed(2);
const mesDaData = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Números do dashboard (spec Comercial, seção 8), calculados no banco a cada
 * consulta. Sem a visão da equipe, tudo fica restrito às vendas e metas do
 * próprio vendedor e o ranking não é montado.
 */
export async function obterDashboard(ator: UsuarioAtual, filtros: FiltrosDashboard) {
  exigirPermissaoComercial(ator, "comercial:ver");
  const equipe = temPermissao(ator.papel, "comercial:ver_equipe");
  const vendedorId = equipe ? filtros.vendedor : ator.id;
  const { mes } = filtros;

  const meses = mesesDaJanela(mes, MESES_DA_SERIE);
  const inicioJanela = dataDoDia(primeiroDiaDoMes(meses[0]!));
  const inicioMes = dataDoDia(primeiroDiaDoMes(mes));
  // Fim exclusivo: dia 1 do mês seguinte ao do filtro.
  const fimJanela = dataDoDia(primeiroDiaDoMes(mesSeguinte(mes)));

  const filtroVendas: Prisma.VendaWhereInput = {
    excluidoEm: null,
    ...(vendedorId ? { vendedorId } : {}),
    ...(filtros.produto ? { produtoId: filtros.produto } : {}),
  };
  const filtroMetas: Prisma.MetaVendaWhereInput = {
    ...(vendedorId ? { vendedorId } : {}),
    ...(filtros.produto ? { produtoId: filtros.produto } : {}),
  };
  const vendasDoMes: Prisma.VendaWhereInput = { ...filtroVendas, dataVenda: { gte: inicioMes, lt: fimJanela } };

  const [vendasJanela, metasJanela, porVendedor, metasPorVendedor, porProduto, metasPorProduto, recentes] = await Promise.all([
    prisma.venda.findMany({
      where: { ...filtroVendas, dataVenda: { gte: inicioJanela, lt: fimJanela } },
      select: { dataVenda: true, valorTotal: true },
    }),
    prisma.metaVenda.findMany({
      where: { ...filtroMetas, mes: { gte: inicioJanela, lt: fimJanela } },
      select: { mes: true, valorAlvo: true, quantidadeAlvo: true },
    }),
    equipe
      ? prisma.venda.groupBy({ by: ["vendedorId"], where: vendasDoMes, _sum: { valorTotal: true }, _count: true })
      : Promise.resolve([]),
    equipe
      ? prisma.metaVenda.groupBy({ by: ["vendedorId"], where: { ...filtroMetas, mes: inicioMes }, _sum: { valorAlvo: true } })
      : Promise.resolve([]),
    prisma.venda.groupBy({ by: ["produtoId"], where: vendasDoMes, _sum: { valorTotal: true }, _count: true }),
    prisma.metaVenda.groupBy({
      by: ["produtoId"],
      where: { ...filtroMetas, mes: inicioMes },
      _sum: { valorAlvo: true, quantidadeAlvo: true },
    }),
    prisma.venda.findMany({
      where: vendasDoMes,
      orderBy: [{ dataVenda: "desc" }, { criadoEm: "desc" }],
      take: 6,
      select: {
        id: true,
        nomeCliente: true,
        valorTotal: true,
        dataVenda: true,
        produto: { select: { nome: true } },
        vendedor: { select: { nome: true } },
      },
    }),
  ]);

  // Série mês a mês, com zero nos meses sem venda ou sem meta.
  const porMes = new Map(meses.map((m) => [m, { vendido: 0, quantidade: 0, meta: 0, metaQuantidade: 0 }]));
  for (const v of vendasJanela) {
    const linha = porMes.get(mesDaData(v.dataVenda));
    if (linha) {
      linha.vendido += centavos(v.valorTotal);
      linha.quantidade += 1;
    }
  }
  for (const m of metasJanela) {
    const linha = porMes.get(mesDaData(m.mes));
    if (linha) {
      linha.meta += centavos(m.valorAlvo);
      linha.metaQuantidade += m.quantidadeAlvo;
    }
  }
  const atual = porMes.get(mes)!;
  const anterior = porMes.get(mesAnterior(mes))!;
  const serie = meses.map((m) => ({ mes: m, vendido: reais(porMes.get(m)!.vendido), meta: reais(porMes.get(m)!.meta) }));

  // Nomes e fotos de quem aparece no ranking e de cada produto da lista.
  const idsVendedores = [...new Set([...porVendedor.map((v) => v.vendedorId), ...metasPorVendedor.map((m) => m.vendedorId)])];
  const idsProdutos = [...new Set([...porProduto.map((p) => p.produtoId), ...metasPorProduto.map((m) => m.produtoId)])];
  const [usuarios, produtos] = await Promise.all([
    idsVendedores.length
      ? prisma.usuario.findMany({ where: { id: { in: idsVendedores } }, select: { id: true, nome: true, imagem: true } })
      : Promise.resolve([]),
    idsProdutos.length
      ? prisma.produto.findMany({ where: { id: { in: idsProdutos } }, select: { id: true, nome: true } })
      : Promise.resolve([]),
  ]);

  const ranking = idsVendedores
    .map((id) => {
      const vendas = porVendedor.find((v) => v.vendedorId === id);
      const meta = centavos(metasPorVendedor.find((m) => m.vendedorId === id)?._sum.valorAlvo);
      const vendido = centavos(vendas?._sum.valorTotal);
      const usuario = usuarios.find((u) => u.id === id);
      return {
        vendedorId: id,
        nome: usuario?.nome ?? "—",
        imagem: usuario?.imagem ?? null,
        vendido: reais(vendido),
        quantidade: vendas?._count ?? 0,
        meta: reais(meta),
        percentual: percentualMeta(vendido, meta),
      };
    })
    .sort((a, b) => Number(b.vendido) - Number(a.vendido) || a.nome.localeCompare(b.nome, "pt-BR"));

  const listaProdutos = idsProdutos
    .map((id) => {
      const vendas = porProduto.find((p) => p.produtoId === id);
      const metas = metasPorProduto.find((m) => m.produtoId === id)?._sum;
      const vendido = centavos(vendas?._sum.valorTotal);
      const metaValor = centavos(metas?.valorAlvo);
      return {
        produtoId: id,
        nome: produtos.find((p) => p.id === id)?.nome ?? "—",
        vendido: reais(vendido),
        quantidade: vendas?._count ?? 0,
        metaValor: reais(metaValor),
        metaQuantidade: metas?.quantidadeAlvo ?? 0,
        percentualValor: percentualMeta(vendido, metaValor),
      };
    })
    .sort((a, b) => Number(b.vendido) - Number(a.vendido) || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    mes,
    equipe,
    numeros: {
      vendido: reais(atual.vendido),
      quantidade: atual.quantidade,
      ticket: ticketMedio(reais(atual.vendido), atual.quantidade),
      variacao: variacao(reais(atual.vendido), reais(anterior.vendido)),
      metaValor: reais(atual.meta),
      metaQuantidade: atual.metaQuantidade,
      percentualValor: percentualMeta(atual.vendido, atual.meta),
      percentualQuantidade: percentualMeta(atual.quantidade, atual.metaQuantidade),
    },
    serie,
    ranking,
    porProduto: listaProdutos,
    recentes: recentes.map((v) => ({
      id: v.id,
      produtoNome: v.produto.nome,
      nomeCliente: v.nomeCliente,
      vendedorNome: v.vendedor.nome,
      valorTotal: v.valorTotal.toFixed(2),
      dataVenda: v.dataVenda.toISOString().slice(0, 10),
    })),
  };
}
export type DadosDashboard = Awaited<ReturnType<typeof obterDashboard>>;
