import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { TelaPublicados } from "@/modulos/conteudo/componentes/telas";
import { lerOrdem } from "@/modulos/conteudo/regras/instagram";
import { listarPublicados } from "@/modulos/conteudo/servicos/conteudos";
import { listarMidiasDoMes } from "@/modulos/conteudo/servicos/visao-instagram";

export const metadata: Metadata = { title: "Publicados — IPEMaster OS" };

export default async function PaginaPublicados({ searchParams }: PageProps<"/conteudo/publicados">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const mes = lerMes(busca);
  const ordem = lerOrdem(typeof busca.ordem === "string" ? busca.ordem : undefined);
  const [linhas, midias] = await Promise.all([listarPublicados(usuario, mes, filtro), listarMidiasDoMes(usuario, mes, filtro, ordem)]);
  return <TelaPublicados mes={mes} linhas={linhas} midias={midias} ordem={ordem} />;
}
