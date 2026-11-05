import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { TelaPlanejamento } from "@/modulos/conteudo/componentes/telas";
import { listarQuadro } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Planejamento — IPEMaster OS" };

export default async function PaginaPlanejamento() {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const quadro = await listarQuadro(usuario, await lerFiltro());
  return <TelaPlanejamento quadro={quadro} />;
}
