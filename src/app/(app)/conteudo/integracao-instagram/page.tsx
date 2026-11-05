import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { IntegracaoInstagram } from "@/modulos/conteudo/componentes/integracao-instagram";
import { atualizacaoRodando } from "@/modulos/conteudo/regras/instagram";
import { situacaoIntegracao } from "@/modulos/conteudo/servicos/integracao-instagram";

export const metadata: Metadata = { title: "Integração Instagram — IPEMaster OS" };

export default async function PaginaIntegracaoInstagram() {
  const usuario = await exigirPermissaoPagina("conteudo:gerenciar_integracao_instagram");
  const situacao = await situacaoIntegracao(usuario);
  return <IntegracaoInstagram situacao={situacao} rodando={atualizacaoRodando(situacao.atualizacoes, new Date())} />;
}
