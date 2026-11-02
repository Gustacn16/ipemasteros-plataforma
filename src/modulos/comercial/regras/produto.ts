// Regras do catálogo de produtos (spec Comercial, seções 4 e 5).

type Cargas = {
  cargaTeoricaPresencial: number | null;
  cargaTeoricaSincrona: number | null;
  cargaTeoricaAssincrona: number | null;
  cargaPratica: number | null;
  cargaExtra: number | null;
};

/** Carga horária total; `null` se nenhuma parte foi informada. */
export function cargaTotal(p: Cargas): number | null {
  const partes = [p.cargaTeoricaPresencial, p.cargaTeoricaSincrona, p.cargaTeoricaAssincrona, p.cargaPratica, p.cargaExtra];
  const informadas = partes.filter((v): v is number => v !== null);
  return informadas.length === 0 ? null : informadas.reduce((a, b) => a + b, 0);
}

/** Produto com venda ou meta não pode ser excluído, só desativado (regra 4). */
export function podeExcluirProduto(usos: { vendas: number; metas: number }): boolean {
  return usos.vendas === 0 && usos.metas === 0;
}

/** Deixa só `idPadrao` como oferta padrão. */
export function ajustarPadrao<T extends { id: string; padrao: boolean }>(ofertas: T[], idPadrao: string): T[] {
  return ofertas.map((o) => ({ ...o, padrao: o.id === idPadrao }));
}
