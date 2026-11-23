import { statusDe, type Status } from "./desempenho";

export type ItemResumo = {
  realizado: number;
  meta: number | null;
  /** Quanto da meta do mês já foi feito (1 = 100%). */
  pct: number | null;
  /** Onde deveríamos estar hoje, em fração da meta (dias passados ÷ dias do mês). */
  esperadoPct: number | null;
  /** Cor pelo ritmo: realizado comparado com o esperado até hoje. */
  status: Status | null;
};

/** Parte do mês que já passou, contando hoje. `hoje` = "AAAA-MM-DD". */
export function fracaoDoMes(hoje: string): number {
  const [a, m, d] = hoje.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return d / diasNoMes;
}

/** Um número do resumo do mês em andamento. Meta nula ou zero = sem meta (sem barra). */
export function itemDoResumo(realizado: number, meta: number | null, hoje: string): ItemResumo {
  if (!meta) return { realizado, meta: null, pct: null, esperadoPct: null, status: null };
  const esperadoPct = fracaoDoMes(hoje);
  const pct = realizado / meta;
  return { realizado, meta, pct, esperadoPct, status: statusDe(pct / esperadoPct) };
}
