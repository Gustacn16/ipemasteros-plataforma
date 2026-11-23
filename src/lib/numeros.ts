/** Aceita "1.234,5", "1234.5", "1.200" (mil e duzentos), "12%" e "R$ 10". */
export function lerNumero(texto: string): number | null {
  let t = texto.replace(/[^\d,.-]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
