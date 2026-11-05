// Cliente de leitura da Marketing API da Meta, sobre a base de `@/lib/meta-graph`
// (pedido, paginação, chave no header e erros em português).
import { criarPedidosGraph } from "@/lib/meta-graph";
import { mensagemErroMeta } from "../regras/meta-ads";

export { ErroMeta, VERSAO_GRAPH } from "@/lib/meta-graph";

export type ContaMeta = { id: string; name: string; currency: string; account_status: number };
export type CampanhaMeta = { id: string; name: string; status: string; objective?: string };
export type InsightMeta = {
  campaign_id: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
};

export type AnuncioMeta = {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  creative?: { thumbnail_url?: string; image_url?: string };
};
export type InsightAnuncioMeta = {
  ad_id: string;
  campaign_id: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
};

/** Todas as situações de anúncio menos "excluído" (a Meta não devolve excluídos nesta lista). */
const SITUACOES_ANUNCIO = [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "IN_PROCESS",
  "WITH_ISSUES",
  "DISAPPROVED",
  "PENDING_REVIEW",
  "PREAPPROVED",
  "PENDING_BILLING_INFO",
];

export function criarClienteMeta(token: string, fetchFn: typeof fetch = fetch) {
  const { todas } = criarPedidosGraph(token, mensagemErroMeta, fetchFn);

  return {
    listarContas: () => todas<ContaMeta>("me/adaccounts", { fields: "id,name,currency,account_status", limit: "200" }),
    listarCampanhas: (contaId: string) => todas<CampanhaMeta>(`${contaId}/campaigns`, { fields: "id,name,status,objective", limit: "500" }),
    listarInsights: (contaId: string, desde: string, ate: string) =>
      todas<InsightMeta>(`${contaId}/insights`, {
        level: "campaign",
        time_increment: "1",
        time_range: JSON.stringify({ since: desde, until: ate }),
        fields: "campaign_id,spend,impressions,reach,clicks,inline_link_clicks,actions",
        limit: "500",
      }),
    listarAnuncios: (contaId: string) =>
      todas<AnuncioMeta>(`${contaId}/ads`, {
        fields: "id,name,status,campaign_id,creative{thumbnail_url,image_url}",
        // Sem isto a Meta deixa de fora os arquivados, que têm gasto no histórico.
        effective_status: JSON.stringify(SITUACOES_ANUNCIO),
        limit: "200",
      }),
    listarInsightsAnuncios: (contaId: string, desde: string, ate: string) =>
      todas<InsightAnuncioMeta>(`${contaId}/insights`, {
        level: "ad",
        time_increment: "1",
        time_range: JSON.stringify({ since: desde, until: ate }),
        fields: "ad_id,campaign_id,spend,impressions,inline_link_clicks,actions",
        limit: "500",
      }),
  };
}
export type ClienteMeta = ReturnType<typeof criarClienteMeta>;
