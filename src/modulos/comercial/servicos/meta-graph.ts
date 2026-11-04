// Cliente de leitura da Graph API (Marketing API) da Meta. Só leitura; sem
// "server-only" para poder ser testado com respostas gravadas (fetch injetável).
// A chave vai no header Authorization, nunca na URL (assim a Meta também a tira dos
// links de paginação). Nenhum erro original é logado ou repassado: só mensagens em português.
import { mensagemErroMeta } from "../regras/meta-ads";

/** Versão da Graph API (changelog da Meta: v26.0, de 29/07/2026). Revisar uma vez por ano. */
export const VERSAO_GRAPH = "v26.0";
const BASE = `https://graph.facebook.com/${VERSAO_GRAPH}`;

export class ErroMeta extends Error {
  constructor(
    mensagem: string,
    readonly codigo?: number,
  ) {
    super(mensagem);
    this.name = "ErroMeta";
  }
}

type Pagina<T> = { data?: T[]; paging?: { next?: string }; error?: { code?: number; message?: string } };

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

export function criarClienteMeta(token: string, fetchFn: typeof fetch = fetch) {
  async function pedir<T>(url: string): Promise<Pagina<T>> {
    let resposta: Response;
    try {
      resposta = await fetchFn(url, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // O erro original não é repassado: só a mensagem em português.
      throw new ErroMeta("Não foi possível falar com a Meta.");
    }
    const corpo = (await resposta.json().catch(() => ({}))) as Pagina<T>;
    if (!resposta.ok || corpo.error) {
      throw new ErroMeta(mensagemErroMeta(corpo.error?.code, corpo.error?.message ?? `HTTP ${resposta.status}`), corpo.error?.code);
    }
    return corpo;
  }

  /** Segue `paging.next` até a última página. */
  async function todas<T>(caminho: string, parametros: Record<string, string>): Promise<T[]> {
    const url = new URL(`${BASE}/${caminho}`);
    for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);
    const itens: T[] = [];
    let proxima: string | undefined = url.toString();
    while (proxima) {
      const pagina: Pagina<T> = await pedir<T>(proxima);
      itens.push(...(pagina.data ?? []));
      proxima = pagina.paging?.next;
    }
    return itens;
  }

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
  };
}
export type ClienteMeta = ReturnType<typeof criarClienteMeta>;
