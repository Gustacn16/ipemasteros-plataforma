import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { PainelDashboard } from "@/modulos/comercial/componentes/dashboard/painel-dashboard";
import { esquemaFiltrosDashboard } from "@/modulos/comercial/esquemas/dashboard";
import { obterDashboard } from "@/modulos/comercial/servicos/dashboard";
import { listarProdutosParaVenda } from "@/modulos/comercial/servicos/produtos";
import { listarVendedores } from "@/modulos/comercial/servicos/vendas";

export const metadata: Metadata = { title: "Dashboard comercial — IPEMaster OS" };

export default async function PaginaDashboard({ searchParams }: PageProps<"/comercial">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosDashboard(new Date()).parse({
    mes: texto(busca.mes),
    produto: texto(busca.produto),
    vendedor: texto(busca.vendedor),
  });
  const [dados, produtos, vendedores] = await Promise.all([
    obterDashboard(usuario, filtros),
    listarProdutosParaVenda(),
    listarVendedores(),
  ]);
  return (
    <PainelDashboard
      dados={dados}
      produtos={produtos.map((p) => ({ id: p.id, nome: p.nome }))}
      vendedores={dados.equipe ? vendedores : []}
    />
  );
}
