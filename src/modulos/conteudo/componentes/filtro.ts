import { cookies } from "next/headers";
import { COOKIE_FILTRO, esquemaMes, filtroDoCookie, type FiltroConteudo } from "../esquemas/conteudo";
import { mesAtual } from "../regras/calendario";

type Busca = Record<string, string | string[] | undefined>;

const texto = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Filtro salvo da pessoa (conta, canal, responsável, formato, etapa). Vale até ela limpar. */
export async function lerFiltro(): Promise<FiltroConteudo> {
  return filtroDoCookie((await cookies()).get(COOKIE_FILTRO)?.value);
}

export function lerMes(busca: Busca): string {
  return esquemaMes.parse(texto(busca.mes)) ?? mesAtual();
}
