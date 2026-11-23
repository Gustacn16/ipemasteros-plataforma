import { formatarReais } from "@/lib/dinheiro";
import type { Status } from "../regras/desempenho";

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** Valor de indicador para a tela. Percentual chega como fração. */
export function formatarValor(unidade: string, v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (unidade === "reais") return formatarReais(Math.round(v));
  if (unidade === "percentual") return pct.format(v);
  return numero.format(v);
}

export const formatarPct = (v: number | null) => (v === null ? "—" : pct.format(v));
export const reaisDeCentavos = (c: number | null) => (c === null ? "—" : formatarReais(Math.round(c / 100)));

export const SIMBOLO_STATUS: Record<Status, string> = { ok: "✔", atencao: "⚠", ruim: "✖" };
export const ROTULO_STATUS: Record<Status, string> = { ok: "No caminho", atencao: "Atenção", ruim: "Fora do caminho" };
export const COR_STATUS: Record<Status, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  atencao: "text-amber-700 dark:text-amber-400",
  ruim: "text-red-700 dark:text-red-400",
};

const mesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
/** "2027-01" → "jan" */
export const rotuloMesCurto = (mes: string) => mesCurto.format(new Date(`${mes}-01T00:00:00Z`)).replace(".", "");
const mesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
export const rotuloMesLongo = (mes: string) => mesLongo.format(new Date(`${mes}-01T00:00:00Z`));

/** Número para preencher um campo ("7", "35,5"), sem resto de ponto flutuante. */
export const numeroParaCampo = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false });
