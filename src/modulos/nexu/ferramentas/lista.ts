/** Limita listas devolvidas ao modelo, informando o total real. */
export function limitarLista<T>(itens: T[], max = 50): { itens: T[]; total: number; mostrando: number } {
  const recorte = itens.slice(0, max);
  return { itens: recorte, total: itens.length, mostrando: recorte.length };
}
