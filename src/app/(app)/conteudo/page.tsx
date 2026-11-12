import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { TelaVisaoGeral } from "@/modulos/conteudo/componentes/telas";
import { visaoGeral } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Conteúdo — IPEMaster OS" };

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const filtro = await lerFiltro();
  return <TelaVisaoGeral v={await visaoGeral(usuario, filtro)} />;
}
