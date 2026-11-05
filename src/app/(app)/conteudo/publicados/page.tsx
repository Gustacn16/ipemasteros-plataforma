import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { TelaPublicados } from "@/modulos/conteudo/componentes/telas";
import { listarPublicados } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Publicados — IPEMaster OS" };

export default async function PaginaPublicados({ searchParams }: PageProps<"/conteudo/publicados">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const mes = lerMes(busca);
  const linhas = await listarPublicados(usuario, mes, filtro);
  return <TelaPublicados mes={mes} linhas={linhas} />;
}
