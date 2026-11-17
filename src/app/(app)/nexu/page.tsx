import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { TelaNexu } from "@/modulos/nexu/componentes/tela-nexu";
import { dadosDaTelaNexu } from "./dados";

export const metadata: Metadata = { title: "Nexu — IPEMaster OS" };

export default async function PaginaNexuConversas() {
  const ator = await exigirPermissaoPagina("nexu:usar");
  const dados = await dadosDaTelaNexu(ator);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CabecalhoPagina titulo="Nexu" descricao="Seu assistente de IA. As conversas são só suas e somem após 90 dias sem uso." />
      <TelaNexu {...dados} atual={null} />
    </div>
  );
}
