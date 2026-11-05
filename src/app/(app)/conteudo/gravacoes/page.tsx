import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { TelaGravacoes } from "@/modulos/conteudo/componentes/telas";
import { listarGravacoes } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Gravações — IPEMaster OS" };

export default async function PaginaGravacoes() {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const { aGravar, gravados } = await listarGravacoes(usuario, await lerFiltro());
  return <TelaGravacoes aGravar={aGravar} gravados={gravados} />;
}
