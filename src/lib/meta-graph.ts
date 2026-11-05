// Base de leitura da Graph API da Meta, usada pelo Comercial (Meta Ads) e pelo
// Conteúdo (Instagram). Sem "server-only" para poder ser testada com respostas
// gravadas (fetch injetável). A chave vai no header Authorization, nunca na URL
// (assim a Meta também a tira dos links de paginação). Nenhum erro original é
// logado ou repassado: só mensagens em português.

/** Versão da Graph API (changelog da Meta: v26.0, de 29/07/2026). Revisar uma vez por ano. */
export const VERSAO_GRAPH = "v26.0";
export const BASE_GRAPH = `https://graph.facebook.com/${VERSAO_GRAPH}`;

export class ErroMeta extends Error {
  constructor(
    mensagem: string,
    readonly codigo?: number,
  ) {
    super(mensagem);
    this.name = "ErroMeta";
  }
}

export type Pagina<T> = { data?: T[]; paging?: { next?: string }; error?: { code?: number; message?: string } };

/** Traduz o erro da Meta (código e mensagem original) para o texto mostrado na tela. */
export type TraduzirErroMeta = (codigo: number | undefined, mensagem: string) => string;

export function criarPedidosGraph(token: string, traduzir: TraduzirErroMeta, fetchFn: typeof fetch = fetch) {
  /** `url` pode ser completa (links de paginação) ou relativa a `BASE_GRAPH`. */
  async function pedir<T>(url: string): Promise<Pagina<T>> {
    const completa = url.startsWith("https://") ? url : `${BASE_GRAPH}/${url}`;
    let resposta: Response;
    try {
      resposta = await fetchFn(completa, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // O erro original não é repassado: só a mensagem em português.
      throw new ErroMeta("Não foi possível falar com a Meta.");
    }
    const corpo = (await resposta.json().catch(() => ({}))) as Pagina<T>;
    if (!resposta.ok || corpo.error) {
      throw new ErroMeta(traduzir(corpo.error?.code, corpo.error?.message ?? `HTTP ${resposta.status}`), corpo.error?.code);
    }
    return corpo;
  }

  /**
   * Segue `paging.next` até a última página. Com `parar`, interrompe no primeiro
   * item em que ele é verdadeiro (listas em ordem decrescente de data, por exemplo)
   * e devolve só os itens anteriores a ele.
   */
  async function todas<T>(caminho: string, parametros: Record<string, string>, parar?: (item: T) => boolean): Promise<T[]> {
    const url = new URL(`${BASE_GRAPH}/${caminho}`);
    for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);
    const itens: T[] = [];
    let proxima: string | undefined = url.toString();
    while (proxima) {
      const pagina: Pagina<T> = await pedir<T>(proxima);
      for (const item of pagina.data ?? []) {
        if (parar?.(item)) return itens;
        itens.push(item);
      }
      proxima = pagina.paging?.next;
    }
    return itens;
  }

  return { pedir, todas };
}
