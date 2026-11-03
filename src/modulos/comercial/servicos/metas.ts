import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosMetasProduto } from "../esquemas/meta";
import { type MetaChave, mesAnterior, metaVazia, metasParaCopiar, primeiroDiaDoMes } from "../regras/meta";
import { MENSAGEM_NAO_ENCONTRADO, exigirPermissaoComercial } from "./acesso";
import { listarVendedores } from "./vendas";

// Coluna @db.Date do dia 1 do mês.
const dataDoMes = (mes: string) => new Date(`${primeiroDiaDoMes(mes)}T00:00:00Z`);

const comoChave = (m: {
  produtoId: string;
  vendedorId: string;
  valorAlvo: { toFixed(n: number): string };
  quantidadeAlvo: number;
}): MetaChave => ({
  produtoId: m.produtoId,
  vendedorId: m.vendedorId,
  valorAlvo: m.valorAlvo.toFixed(2),
  quantidadeAlvo: m.quantidadeAlvo,
});

/**
 * Metas do mês para a tela. Produtos ativos, mais os que já têm meta no mês
 * (regra 3); vendedores ativos, mais os que já têm meta. Sem a visão da equipe,
 * só a própria linha, sem edição.
 */
export async function obterMetasDoMes(ator: UsuarioAtual, mes: string) {
  exigirPermissaoComercial(ator, "comercial:ver");
  const equipe = temPermissao(ator.papel, "comercial:ver_equipe");
  const metas = await prisma.metaVenda.findMany({
    where: { mes: dataDoMes(mes), ...(equipe ? {} : { vendedorId: ator.id }) },
    select: {
      produtoId: true,
      vendedorId: true,
      valorAlvo: true,
      quantidadeAlvo: true,
      vendedor: { select: { id: true, nome: true } },
    },
  });
  const comMeta = [...new Set(metas.map((m) => m.produtoId))];
  const [produtos, ativos] = await Promise.all([
    prisma.produto.findMany({
      where: { excluidoEm: null, OR: [{ ativo: true }, { id: { in: comMeta } }] },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, tipo: true, ativo: true },
    }),
    equipe ? listarVendedores() : Promise.resolve([{ id: ator.id, nome: ator.nome }]),
  ]);
  const vendedores = [...ativos];
  for (const m of metas) if (!vendedores.some((v) => v.id === m.vendedorId)) vendedores.push(m.vendedor);
  vendedores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    mes,
    podeEditar: temPermissao(ator.papel, "comercial:gerenciar_metas"),
    produtos,
    vendedores,
    metas: metas.map(comoChave),
  };
}
export type MetasDoMes = Awaited<ReturnType<typeof obterMetasDoMes>>;

/** Grava as metas de um produto no mês. Linha vazia apaga a meta (não guarda zero). */
export async function salvarMetasProduto(ator: UsuarioAtual, dados: DadosMetasProduto) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_metas");
  const mes = dataDoMes(dados.mes);
  await prisma.$transaction(async (tx) => {
    const produto = await tx.produto.findFirst({ where: { id: dados.produtoId, excluidoEm: null }, select: { id: true } });
    if (!produto) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);

    // Vendedor precisa ser válido (regra 5) ou já ter meta neste produto e mês.
    const ids = [...new Set(dados.linhas.map((l) => l.vendedorId))];
    const [validos, comMeta] = await Promise.all([
      tx.usuario.findMany({
        where: { id: { in: ids }, ativo: true, papel: { in: ["comercial", "gestor", "admin"] } },
        select: { id: true },
      }),
      tx.metaVenda.findMany({ where: { mes, produtoId: dados.produtoId, vendedorId: { in: ids } }, select: { vendedorId: true } }),
    ]);
    const aceitos = new Set([...validos.map((v) => v.id), ...comMeta.map((m) => m.vendedorId)]);
    if (ids.some((id) => !aceitos.has(id))) throw new ErroNegocio("Vendedor inválido.");

    for (const linha of dados.linhas) {
      const chave = { mes_produtoId_vendedorId: { mes, produtoId: dados.produtoId, vendedorId: linha.vendedorId } };
      if (metaVazia(linha)) {
        await tx.metaVenda.deleteMany({ where: { mes, produtoId: dados.produtoId, vendedorId: linha.vendedorId } });
        continue;
      }
      await tx.metaVenda.upsert({
        where: chave,
        create: {
          mes,
          produtoId: dados.produtoId,
          vendedorId: linha.vendedorId,
          valorAlvo: linha.valorAlvo,
          quantidadeAlvo: linha.quantidadeAlvo,
        },
        update: { valorAlvo: linha.valorAlvo, quantidadeAlvo: linha.quantidadeAlvo },
      });
    }
  });
}

/** "Copiar do mês anterior" (regra 9). Devolve quantas metas criou. */
export async function copiarMetasMesAnterior(ator: UsuarioAtual, mes: string): Promise<number> {
  exigirPermissaoComercial(ator, "comercial:gerenciar_metas");
  const [anteriores, existentes, produtos, vendedores] = await Promise.all([
    prisma.metaVenda.findMany({ where: { mes: dataDoMes(mesAnterior(mes)) } }),
    prisma.metaVenda.findMany({ where: { mes: dataDoMes(mes) }, select: { produtoId: true, vendedorId: true } }),
    prisma.produto.findMany({ where: { excluidoEm: null, ativo: true }, select: { id: true } }),
    listarVendedores(),
  ]);
  const novas = metasParaCopiar(anteriores.map(comoChave), existentes, {
    produtos: produtos.map((p) => p.id),
    vendedores: vendedores.map((v) => v.id),
  });
  if (novas.length === 0) return 0;
  // skipDuplicates: se alguém salvou uma meta ao mesmo tempo, ela não é sobrescrita.
  const { count } = await prisma.metaVenda.createMany({ data: novas.map((m) => ({ ...m, mes: dataDoMes(mes) })), skipDuplicates: true });
  return count;
}
