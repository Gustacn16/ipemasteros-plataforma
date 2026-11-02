import { esquemaFiltroConteudo, esquemaMes, type FiltroConteudo } from "../esquemas/conteudo";
import { mesAtual } from "../regras/calendario";

type Busca = Record<string, string | string[] | undefined>;

const texto = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Lê ?marca= e ?canal= dos searchParams de uma página do módulo. */
export function lerFiltro(busca: Busca): FiltroConteudo {
  return esquemaFiltroConteudo.parse({ marca: texto(busca.marca), canal: texto(busca.canal) });
}

export function lerMes(busca: Busca): string {
  return esquemaMes.parse(texto(busca.mes)) ?? mesAtual();
}

/** Monta a URL mantendo o filtro de conta/canal. */
export function urlComFiltro(caminho: string, filtro: FiltroConteudo, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ ...(filtro.marca ? { marca: filtro.marca } : {}), ...(filtro.canal ? { canal: filtro.canal } : {}), ...extra });
  return p.size ? `${caminho}?${p}` : caminho;
}
