import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { IntegracaoMeta } from "@/modulos/comercial/componentes/integracao-meta";
import { importacaoRodando } from "@/modulos/comercial/regras/meta-ads";
import { situacaoIntegracao } from "@/modulos/comercial/servicos/importacao-meta";

export const metadata: Metadata = { title: "Meta Ads — IPEMaster OS" };

export default async function PaginaIntegracaoMeta() {
  await exigirPermissaoPagina("comercial:gerenciar_integracao_meta");
  const situacao = await situacaoIntegracao();
  return <IntegracaoMeta situacao={situacao} rodando={importacaoRodando(situacao.importacoes, new Date())} />;
}
