import { cookies } from "next/headers";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { COOKIE_FILTRO, filtroDoCookie, type FiltroAgenda } from "../esquemas/agenda";
import type { VisaoAgenda } from "../regras/periodo";

type Busca = Record<string, string | string[] | undefined>;

const texto = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const VISOES: VisaoAgenda[] = ["mes", "semana", "lista"];

/** Camadas e visão salvas da pessoa. Valem até ela limpar. */
export async function lerFiltro(): Promise<FiltroAgenda> {
  return filtroDoCookie((await cookies()).get(COOKIE_FILTRO)?.value);
}

/** `?visao=` manda; sem ele, vale a do cookie; sem nada, o mês. */
export function lerVisao(busca: Busca, filtro: FiltroAgenda): VisaoAgenda {
  const daUrl = texto(busca.visao);
  if (daUrl && (VISOES as string[]).includes(daUrl)) return daUrl as VisaoAgenda;
  return filtro.visao ?? "mes";
}

/** `?data=AAAA-MM-DD` válida, ou hoje em São Paulo. */
export function lerData(busca: Busca, agora = new Date()): string {
  const v = texto(busca.data);
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    if (new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)) return v;
  }
  return diaEmSaoPaulo(agora);
}
