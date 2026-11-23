import { nomeBusca } from "@/modulos/academico/regras/normalizar";

// Sumário "Nesta página": títulos ## e ### do texto, com âncoras estáveis.

export type ItemSumario = { nivel: 2 | 3; texto: string; id: string };

/** Âncora a partir do texto já sem Markdown. Mesma regra no texto e no sumário. */
export function ancoraDoTitulo(texto: string): string {
  const s = nomeBusca(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `s-${s || "secao"}`;
}

/** Tira a marcação de linha do título: links, negrito, itálico e código. */
export function textoSemMarcacao(t: string): string {
  return t
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extrairSumario(markdown: string | null): ItemSumario[] {
  if (!markdown) return [];
  const itens: ItemSumario[] = [];
  let emCodigo = false;
  for (const linha of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(linha)) emCodigo = !emCodigo;
    if (emCodigo) continue;
    const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(linha);
    if (!m) continue;
    const texto = textoSemMarcacao(m[2]!);
    if (!texto) continue;
    itens.push({ nivel: m[1]!.length === 3 ? 3 : 2, texto, id: ancoraDoTitulo(texto) });
  }
  return itens;
}

/** Documento anterior e próximo na ordem da árvore. */
export function vizinhos<T extends { id: string }>(ordem: T[], id: string): { anterior: T | null; proximo: T | null } {
  const i = ordem.findIndex((d) => d.id === id);
  if (i < 0) return { anterior: null, proximo: null };
  return { anterior: ordem[i - 1] ?? null, proximo: ordem[i + 1] ?? null };
}
