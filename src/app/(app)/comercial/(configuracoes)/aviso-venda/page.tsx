import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AvisoVenda } from "@/modulos/comercial/componentes/aviso-venda";
import { situacaoAvisoVenda } from "@/modulos/comercial/servicos/aviso-venda";

export const metadata: Metadata = { title: "Aviso de venda — IPEMaster OS" };

export default async function PaginaAvisoVenda() {
  const usuario = await exigirPermissaoPagina("comercial:gerenciar_aviso_venda");
  return <AvisoVenda situacao={await situacaoAvisoVenda(usuario)} />;
}
