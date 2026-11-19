/** Data da próxima revisão do padrão, ou null se não houver prazo ou publicação. */
export function proximaRevisao(publicadoEm: Date | null, meses: number | null): Date | null {
  if (!publicadoEm || !meses || meses <= 0) return null;
  const d = new Date(publicadoEm);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d;
}

export function revisaoVencida(publicadoEm: Date | null, meses: number | null, agora: Date): boolean {
  const p = proximaRevisao(publicadoEm, meses);
  return p !== null && p.getTime() < agora.getTime();
}
