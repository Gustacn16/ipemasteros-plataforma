export type Tom = "sucesso" | "atencao" | "perigo" | "informacao" | "neutro";

/** Faixa do percentual: verde ≥ 80, âmbar 60–79, vermelho < 60. Sem valor, null. */
export function faixaDoPercentual(p: number | null): "sucesso" | "atencao" | "perigo" | null {
  if (p === null || !Number.isFinite(p)) return null;
  if (p >= 80) return "sucesso";
  if (p >= 60) return "atencao";
  return "perigo";
}

/** Texto da variação contra o período anterior. Sem base (null, NaN, Infinity), null. */
export function textoVariacao(
  v: number | null,
  unidade: "%" | "pp" = "%",
): { texto: string; tom: Tom } | null {
  if (v === null || !Number.isFinite(v)) return null;
  if (v === 0) return { texto: "=", tom: "neutro" }; // 0 === -0
  const sufixo = unidade === "pp" ? " pp" : "%";
  const abs = Math.abs(v);
  return v > 0
    ? { texto: `↑ ${abs}${sufixo}`, tom: "sucesso" }
    : { texto: `↓ ${abs}${sufixo}`, tom: "perigo" };
}

/** Classes de texto por tom (só tokens). */
export const CLASSE_TEXTO_TOM: Record<Tom, string> = {
  sucesso: "text-sucesso",
  atencao: "text-atencao",
  perigo: "text-perigo",
  informacao: "text-informacao",
  neutro: "text-muted-foreground",
};
