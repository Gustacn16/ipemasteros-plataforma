import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { TelaItemConteudo } from "@/modulos/conteudo/componentes/telas";
import { obterConteudo } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Conteúdo — IPEMaster OS" };

export default async function PaginaItemConteudo({ params }: PageProps<"/conteudo/itens/[id]">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const { id } = await params;
  const dados = await obterConteudo(usuario, id).catch((erro) => {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  });
  return <TelaItemConteudo {...dados} />;
}
