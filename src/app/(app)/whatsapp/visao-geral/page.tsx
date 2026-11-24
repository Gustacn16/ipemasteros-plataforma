import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { VisaoGeral } from "@/modulos/whatsapp/componentes/visao-geral";
import { panoramaWhatsapp } from "@/modulos/whatsapp/servicos/visao-geral";

export const metadata: Metadata = { title: "Visão geral do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("whatsapp:ver_equipe");
  const panorama = await panoramaWhatsapp(usuario);

  return (
    <div className="grid max-w-6xl gap-6">
      <CabecalhoPagina titulo="WhatsApp" descricao="Como estão os números, as oportunidades e o que precisa de atenção." />
      <AbasWhatsapp papel={usuario.papel} ativa="visao-geral" />
      <VisaoGeral panorama={panorama} />
    </div>
  );
}
