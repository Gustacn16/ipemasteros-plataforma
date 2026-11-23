export type Sentido = "maior_melhor" | "menor_melhor";
export type Tipo = "fluxo" | "estoque" | "taxa";
export type Status = "ok" | "atencao" | "ruim";

/** Quanto da meta foi alcançado (1 = 100%). Sem meta, meta zero ou sem realizado → null. */
export function desempenho(realizado: number | null, meta: number | null, sentido: Sentido): number | null {
  if (realizado === null || meta === null || meta === 0) return null;
  if (sentido === "menor_melhor") return realizado === 0 ? null : meta / realizado;
  return realizado / meta;
}

/** ✔ ≥ 100% · ⚠ 80–99% · ✖ < 80%. */
export function statusDe(pct: number | null): Status | null {
  if (pct === null) return null;
  if (pct >= 1) return "ok";
  if (pct >= 0.8) return "atencao";
  return "ruim";
}

type Mes = { mes: string; meta: number | null; realizado: number | null };
const media = (v: number[]) => (v.length === 0 ? null : v.reduce((s, x) => s + x, 0) / v.length);

/** Acumulado dos meses que já começaram (recebe só esses). */
export function acumular(tipo: Tipo, meses: Mes[]): { meta: number | null; realizado: number | null } {
  if (tipo === "estoque") {
    const ultimo = [...meses].reverse().find((m) => m.realizado !== null);
    return ultimo ? { meta: ultimo.meta, realizado: ultimo.realizado } : { meta: meses.at(-1)?.meta ?? null, realizado: null };
  }
  const metas = meses.map((m) => m.meta).filter((v): v is number => v !== null);
  const reais = meses.map((m) => m.realizado).filter((v): v is number => v !== null);
  if (tipo === "taxa") return { meta: media(metas), realizado: media(reais) };
  return {
    meta: metas.length ? metas.reduce((s, v) => s + v, 0) : null,
    realizado: reais.length ? reais.reduce((s, v) => s + v, 0) : null,
  };
}

/** Razão do período somando antes de dividir (ex.: CAC do ano = custo do ano ÷ alunos do ano). */
export function razaoAcumulada(itens: { num: number; den: number }[]): number | null {
  const num = itens.reduce((s, i) => s + i.num, 0);
  const den = itens.reduce((s, i) => s + i.den, 0);
  return den === 0 ? null : num / den;
}
