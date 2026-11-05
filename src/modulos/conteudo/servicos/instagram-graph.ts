// Cliente de leitura do Instagram na Graph API, sobre a base de `@/lib/meta-graph`
// (pedido, paginação, chave no header e erros em português). Sem "server-only"
// para poder ser testado com respostas gravadas (fetch injetável).
import { ErroMeta, criarPedidosGraph } from "@/lib/meta-graph";
import { inicioDoDiaSaoPaulo } from "@/modulos/tarefas/regras/relatorio";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { type InsightMeta, METRICAS_POR_TIPO, type TipoMidia, mensagemErroInstagram } from "../regras/instagram";

export type MidiaMeta = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  permalink: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
};

type PaginaMeta = {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username: string; name?: string; profile_picture_url?: string };
};

const CAMPOS_MIDIA = "id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url";
const METRICAS_CONTA = "reach,views,total_interactions,likes,comments,saves,shares,profile_links_taps";
const segundos = (data: Date) => String(Math.floor(data.getTime() / 1000));

export function criarClienteInstagram(token: string, fetchFn: typeof fetch = fetch) {
  const { pedir, todas } = criarPedidosGraph(token, mensagemErroInstagram, fetchFn);

  return {
    /** Contas profissionais ligadas às Páginas que a chave enxerga (regra 5.1). */
    async listarContas() {
      const paginas = await todas<PaginaMeta>("me/accounts", {
        fields: "id,name,instagram_business_account{id,username,name,profile_picture_url}",
        limit: "100",
      });
      return paginas.flatMap((p) =>
        p.instagram_business_account
          ? [
              {
                idExterno: p.instagram_business_account.id,
                usuario: p.instagram_business_account.username,
                nome: p.instagram_business_account.name ?? null,
                paginaId: p.id,
                fotoUrl: p.instagram_business_account.profile_picture_url ?? null,
              },
            ]
          : [],
      );
    },
    /** Posts do mais novo para o mais antigo, até o primeiro anterior a `desde` (regra 5.3). */
    listarMidias: (contaId: string, desde: Date) =>
      todas<MidiaMeta>(`${contaId}/media`, { fields: CAMPOS_MIDIA, limit: "100" }, (m) => new Date(m.timestamp) < desde),
    /** Stories no ar agora (regra 5.4). */
    listarStories: (contaId: string) => todas<MidiaMeta>(`${contaId}/stories`, { fields: CAMPOS_MIDIA, limit: "100" }),
    /** Números de um post. No story, o erro 10 (menos de 5 visualizações) volta sem números (regra 5.5). */
    async insightsMidia(midiaId: string, tipo: TipoMidia): Promise<InsightMeta[]> {
      try {
        const r = await pedir<InsightMeta>(`${midiaId}/insights?metric=${METRICAS_POR_TIPO[tipo].join(",")}`);
        return r.data ?? [];
      } catch (erro) {
        if (tipo === "story" && erro instanceof ErroMeta && erro.codigo === 10) return [];
        throw erro;
      }
    },
    /**
     * Números da conta somados do início de `desde` ao fim de `ate`, em São Paulo (regra 5.6).
     * `follows_and_unfollows` vai num pedido próprio, porque só ele aceita a divisão `follow_type`.
     */
    async insightsConta(contaId: string, desde: string, ate: string): Promise<InsightMeta[]> {
      const periodo = {
        period: "day",
        metric_type: "total_value",
        since: segundos(inicioDoDiaSaoPaulo(desde)),
        until: segundos(inicioDoDiaSaoPaulo(somarDias(ate, 1))),
      };
      const totais = new URLSearchParams({ metric: METRICAS_CONTA, ...periodo });
      const seguir = new URLSearchParams({ metric: "follows_and_unfollows", breakdown: "follow_type", ...periodo });
      const [a, b] = await Promise.all([
        pedir<InsightMeta>(`${contaId}/insights?${totais}`),
        pedir<InsightMeta>(`${contaId}/insights?${seguir}`),
      ]);
      return [...(a.data ?? []), ...(b.data ?? [])];
    },
    async seguidores(contaId: string): Promise<number | null> {
      const r = (await pedir<never>(`${contaId}?fields=followers_count`)) as { followers_count?: number };
      return typeof r.followers_count === "number" ? r.followers_count : null;
    },
    /** Permissões da chave (regra 5.16). */
    permissoes: () => todas<{ permission: string; status: string }>("me/permissions", {}),
  };
}
export type ClienteInstagram = ReturnType<typeof criarClienteInstagram>;
