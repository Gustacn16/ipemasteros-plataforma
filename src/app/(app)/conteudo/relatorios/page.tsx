import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { TelaRelatorios } from "@/modulos/conteudo/componentes/telas";
import { relatorioInstagram } from "@/modulos/conteudo/servicos/visao-instagram";

export const metadata: Metadata = { title: "Relatórios — IPEMaster OS" };

export default async function PaginaRelatorios({ searchParams }: PageProps<"/conteudo/relatorios">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const mes = lerMes(busca);
  const conta = typeof busca.conta === "string" ? busca.conta : undefined;
  const dados = await relatorioInstagram(usuario, await lerFiltro(), mes, conta);
  return <TelaRelatorios mes={mes} dados={dados} podeIntegrar={temPermissao(usuario.papel, "conteudo:gerenciar_integracao_instagram")} />;
}
