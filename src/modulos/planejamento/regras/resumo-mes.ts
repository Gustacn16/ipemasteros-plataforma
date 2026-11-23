import { statusDe, type Status } from "./desempenho";

export type ItemResumo = {
  /** Nulo = a pessoa não tem acesso a esse número (ex.: leads sem ver mídia). */
  realizado: number | null;
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
export function itemDoResumo(realizado: number | null, meta: number | null, hoje: string): ItemResumo {
  if (!meta) return { realizado, meta: null, pct: null, esperadoPct: null, status: null };
  if (realizado === null) return { realizado, meta, pct: null, esperadoPct: null, status: null };
  const esperadoPct = fracaoDoMes(hoje);
  const pct = realizado / meta;
  return { realizado, meta, pct, esperadoPct, status: statusDe(pct / esperadoPct) };
}

export type OrigemMeta = "comercial" | "planejamento" | null;

/** Meta do Comercial quando houver; senão, a do Planejamento; senão, nenhuma. */
function escolherMeta(comercial: number, plano: number | null | undefined): { meta: number | null; de: OrigemMeta } {
  if (comercial > 0) return { meta: comercial, de: "comercial" };
  if (plano) return { meta: plano, de: "planejamento" };
  return { meta: null, de: null };
}

/**
 * Resumo do Início. Vendas e faturamento são os `numeros` do dashboard do Comercial do mês;
 * leads são os do Comercial (nulo sem acesso). A meta do Planejamento só entra quando o
 * Comercial não tem meta (leads nunca têm meta no Comercial).
 */
export function resumoDoInicio(
  fonte: {
    numeros: { vendido: string; quantidade: number; metaValor: string; metaQuantidade: number };
    leads: number | null;
    plano: { alunos: number; valorReais: number; leads: number | null } | null;
  },
  hoje: string,
) {
  const { numeros, leads, plano } = fonte;
  const vendas = escolherMeta(numeros.metaQuantidade, plano?.alunos);
  const faturamento = escolherMeta(Number(numeros.metaValor), plano?.valorReais);
  const metaLeads = escolherMeta(0, plano?.leads);
  return {
    vendas: itemDoResumo(numeros.quantidade, vendas.meta, hoje),
    faturamento: itemDoResumo(Number(numeros.vendido), faturamento.meta, hoje),
    leads: itemDoResumo(leads, metaLeads.meta, hoje),
    metaDe: { vendas: vendas.de, faturamento: faturamento.de, leads: metaLeads.de },
  };
}
