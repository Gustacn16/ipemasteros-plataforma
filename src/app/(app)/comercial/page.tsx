import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { PainelDashboard } from "@/modulos/comercial/componentes/dashboard/painel-dashboard";
import { esquemaFiltrosDashboard } from "@/modulos/comercial/esquemas/dashboard";
import { obterDashboard } from "@/modulos/comercial/servicos/dashboard";
import { obterMidia } from "@/modulos/comercial/servicos/dashboard-midia";
import { listarProdutosParaVenda } from "@/modulos/comercial/servicos/produtos";
import { listarVendedores } from "@/modulos/comercial/servicos/vendas";

export const metadata: Metadata = { title: "Dashboard comercial — IPEMaster OS" };

export default async function PaginaDashboard({ searchParams }: PageProps<"/comercial">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosDashboard(new Date()).parse({
    visao: texto(busca.visao),
    mes: texto(busca.mes),
    produto: texto(busca.produto),
    vendedor: texto(busca.vendedor),
    conta: texto(busca.conta),
    campanhas: texto(busca.campanhas),
    busca: texto(busca.busca),
    situacao: texto(busca.situacao),
    categoria: texto(busca.categoria),
  });
  // Mídia só para quem vê marketing; os demais ficam sempre na visão de vendas.
  const veMidia = temPermissao(usuario.papel, "comercial:ver_marketing");
  const naMidia = veMidia && filtros.visao === "midia";
  const [dados, produtos, vendedores, midia] = await Promise.all([
    obterDashboard(usuario, filtros),
    listarProdutosParaVenda(),
    listarVendedores(),
    naMidia ? obterMidia(usuario, filtros) : Promise.resolve(null),
  ]);
  const comMes = (extra: Record<string, string>) => `/comercial?${new URLSearchParams({ mes: filtros.mes, ...extra })}`;
  // Link de categoria mantém os outros filtros da mídia na URL.
  const filtrosMidia = Object.fromEntries(
    Object.entries({
      conta: filtros.conta,
      campanhas: filtros.campanhas.join(","),
      busca: filtros.busca,
      situacao: filtros.situacao === "todas" ? undefined : filtros.situacao,
    }).filter((e): e is [string, string] => Boolean(e[1])),
  );
  const links = veMidia
    ? {
        vendas: comMes({}),
        midia: comMes({ visao: "midia" }),
        campanha: (id: string) => comMes({ visao: "midia", campanhas: id }),
        categoria: (categoria: string | null) => comMes({ visao: "midia", ...filtrosMidia, ...(categoria ? { categoria } : {}) }),
      }
    : null;
  return (
    <PainelDashboard
      dados={dados}
      produtos={produtos.map((p) => ({ id: p.id, nome: p.nome }))}
      vendedores={dados.equipe ? vendedores : []}
      midia={midia}
      links={links}
    />
  );
}
