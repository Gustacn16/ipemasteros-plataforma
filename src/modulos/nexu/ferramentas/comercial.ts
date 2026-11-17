import { z } from "zod";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { mesSeguinte } from "@/modulos/comercial/regras/meta";
import { obterVisaoMetas } from "@/modulos/comercial/servicos/metas";
import { listarProdutosAtivos } from "@/modulos/comercial/servicos/produtos";
import { listarVendas } from "@/modulos/comercial/servicos/vendas";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";
import { validarMes } from "./validacao";

const centavos = (v: string) => Math.round(Number(v) * 100);
const reais = (c: number) => (c / 100).toFixed(2);

function resumir(vendas: { chave: string; valorTotal: string }[]) {
  const grupos = new Map<string, { quantidade: number; centavos: number }>();
  for (const v of vendas) {
    const g = grupos.get(v.chave) ?? { quantidade: 0, centavos: 0 };
    g.quantidade++;
    g.centavos += centavos(v.valorTotal);
    grupos.set(v.chave, g);
  }
  return [...grupos].map(([nome, g]) => ({ nome, quantidade: g.quantidade, valorTotal: reais(g.centavos) }));
}

const entradaVendas = z.object({
  mes: z.string().describe("mês, no formato AAAA-MM"),
  vendedorId: z.string().optional().describe("id do vendedor (só vale para quem vê a equipe)"),
});

export const ferramentaVendasEMetas: FerramentaNexu<typeof entradaVendas> = {
  nome: "vendas_e_metas",
  descricao:
    "Vendas do mês (data, produto, vendedor, canal, valor), resumo por produto e por vendedor, e progresso das metas. O vendedor vê só as próprias vendas. Sem dados de contato do cliente.",
  entrada: entradaVendas,
  permissao: "comercial:ver",
  rotulo: "Consultando vendas e metas…",
  tipo: "consulta",
  async executar(ator, { mes, vendedorId }) {
    validarMes(mes);
    const ultimoDia = somarDias(`${mesSeguinte(mes)}-01`, -1);
    const [{ vendas, total, equipe }, metas] = await Promise.all([
      listarVendas(ator, { periodo: "intervalo", de: `${mes}-01`, ate: ultimoDia, vendedor: vendedorId }),
      obterVisaoMetas(ator, mes),
    ]);
    return {
      mes,
      totalVendido: total,
      quantidade: vendas.length,
      porProduto: resumir(vendas.map((v) => ({ chave: v.produtoNome, valorTotal: v.valorTotal }))),
      porVendedor: resumir(vendas.map((v) => ({ chave: v.vendedorNome, valorTotal: v.valorTotal }))),
      vendas: limitarLista(
        vendas.map((v) => ({
          id: v.id,
          dataVenda: v.dataVenda,
          cliente: v.nomeCliente,
          produto: v.produtoNome,
          oferta: v.ofertaNome,
          vendedor: v.vendedorNome,
          canal: v.canalNome,
          metodoPagamento: v.metodoPagamento,
          valorTotal: v.valorTotal,
        })),
      ),
      metas: {
        total: metas.total,
        vendedores: (equipe && vendedorId ? metas.vendedores.filter((m) => m.id === vendedorId) : metas.vendedores).map((m) => ({
          id: m.id,
          nome: m.nome,
          metaValor: m.metaValor,
          metaQuantidade: m.metaQuantidade,
          vendido: m.vendido,
          vendas: m.vendas,
          percentual: m.percentual,
          falta: m.falta,
        })),
      },
    };
  },
};

const entradaProdutos = z.object({});

export const ferramentaProdutos: FerramentaNexu<typeof entradaProdutos> = {
  nome: "produtos",
  descricao: "Catálogo de produtos ativos (nome e tipo).",
  entrada: entradaProdutos,
  permissao: "comercial:ver",
  rotulo: "Consultando produtos…",
  tipo: "consulta",
  async executar(ator) {
    if (!temPermissao(ator.papel, "comercial:ver")) throw new ErroPermissao("comercial:ver");
    return limitarLista((await listarProdutosAtivos()).map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo })));
  },
};
