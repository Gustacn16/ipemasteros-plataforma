import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosComissoesProdutos } from "../esquemas/produto";
import { calcularComissoes } from "../regras/comissao";
import { mesSeguinte, primeiroDiaDoMes } from "../regras/meta";
import { exigirPermissaoComercial } from "./acesso";

const dataDoMes = (mes: string) => new Date(`${primeiroDiaDoMes(mes)}T00:00:00Z`);
const texto = (v: { toFixed(n: number): string }) => v.toFixed(2);

/**
 * Comissões do mês, a partir das vendas registradas (regra em regras/comissao.ts).
 * Com a visão da equipe, todos os vendedores; sem ela, só a própria comissão.
 */
export async function obterComissoes(ator: UsuarioAtual, mes: string) {
  exigirPermissaoComercial(ator, "comercial:ver");
  const equipe = temPermissao(ator.papel, "comercial:ver_equipe");
  const doVendedor = equipe ? {} : { vendedorId: ator.id };
  const [vendas, metas, produtos] = await Promise.all([
    prisma.venda.findMany({
      where: { excluidoEm: null, dataVenda: { gte: dataDoMes(mes), lt: dataDoMes(mesSeguinte(mes)) }, ...doVendedor },
      select: { vendedorId: true, produtoId: true, valorTotal: true, vendedor: { select: { id: true, nome: true } } },
    }),
    prisma.metaVenda.findMany({
      where: { mes: dataDoMes(mes), ...doVendedor },
      select: { vendedorId: true, produtoId: true, quantidadeAlvo: true },
    }),
    prisma.produto.findMany({
      where: { excluidoEm: null },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, ativo: true, comissaoTipo: true, comissaoBase: true, comissaoBonus: true },
    }),
  ]);
  // Os cards mostram quem tem o papel Comercial, mais quem vendeu no mês (gestor ou admin, por exemplo).
  const vendedores = equipe
    ? await prisma.usuario.findMany({
        where: { OR: [{ ativo: true, papel: "comercial" }, { id: { in: vendas.map((v) => v.vendedorId) } }] },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, imagem: true },
      })
    : [{ id: ator.id, nome: ator.nome, imagem: null as string | null }];

  const calculo = calcularComissoes({
    vendedores,
    vendas: vendas.map((v) => ({ vendedorId: v.vendedorId, produtoId: v.produtoId, valorTotal: texto(v.valorTotal) })),
    metas,
    produtos: new Map(
      produtos.map((p) => [p.id, { nome: p.nome, tipo: p.comissaoTipo, base: texto(p.comissaoBase), bonus: texto(p.comissaoBonus) }]),
    ),
  });
  const fotos = new Map(vendedores.map((v) => [v.id, v.imagem]));
  return {
    mes,
    equipe,
    ...calculo,
    vendedores: calculo.vendedores.map((v) => ({ ...v, imagem: fotos.get(v.id) ?? null })),
    podeEditarRegras: temPermissao(ator.papel, "comercial:gerenciar_produtos"),
    produtos: produtos
      .filter((p) => p.ativo)
      .map((p) => ({ id: p.id, nome: p.nome, tipo: p.comissaoTipo, base: texto(p.comissaoBase), bonus: texto(p.comissaoBonus) })),
  };
}
export type DadosComissoes = Awaited<ReturnType<typeof obterComissoes>>;

/** Grava o tipo, a base e o bônus de comissão de vários produtos de uma vez. */
export async function salvarComissoesProdutos(ator: UsuarioAtual, dados: DadosComissoesProdutos) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  await prisma.$transaction(async (tx) => {
    const ids = dados.linhas.map((l) => l.produtoId);
    const existentes = await tx.produto.count({ where: { id: { in: ids }, excluidoEm: null } });
    if (existentes !== new Set(ids).size) throw new ErroNegocio("Produto não encontrado.");
    for (const l of dados.linhas) {
      await tx.produto.update({
        where: { id: l.produtoId },
        data: { comissaoTipo: l.comissaoTipo, comissaoBase: l.comissaoBase, comissaoBonus: l.comissaoBonus },
      });
    }
  });
}
