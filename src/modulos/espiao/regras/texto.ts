// Regras puras de texto das landing pages: extrair o visível, neutralizar o que muda
// sozinho (datas, horas, contadores), achar preços e medir quanto mudou.
import { createHash } from "node:crypto";
import { parse } from "node-html-parser";

const IGNORADOS = "script, style, nav, footer, header, noscript, svg, iframe, template";

/** Texto visível do `body`, sem menus, rodapés e scripts, com espaços colapsados. */
export function extrairTextoVisivel(html: string): string {
  const raiz = parse(html, { blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  for (const el of raiz.querySelectorAll(IGNORADOS)) el.remove();
  const corpo = raiz.querySelector("body") ?? raiz;
  return corpo.structuredText.replace(/\s+/g, " ").trim();
}

/** Troca datas, horas e números de contagem regressiva por marcadores, para não virarem "mudança". */
export function normalizarParaComparar(texto: string): string {
  return texto
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "‹data›")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "‹hora›")
    .replace(/\b\d+(?=\s+(?:dias?|horas?|minutos?|segundos?|vagas?)\b)/gi, "‹n›")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashTexto(texto: string): string {
  return createHash("sha256").update(normalizarParaComparar(texto)).digest("hex");
}

const PARCELADO = /(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)/gi;
const A_VISTA = /R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)/gi;

function valor(bruto: string): string {
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Preços na ordem em que aparecem, padronizados ("12x R$ 899,00", "R$ 9.990,00") e sem repetir. */
export function extrairPrecos(texto: string): string[] {
  const achados: { pos: number; preco: string }[] = [];
  const mascarado = texto.replace(PARCELADO, (trecho, parcelas: string, v: string, pos: number) => {
    achados.push({ pos, preco: `${Number(parcelas)}x R$ ${valor(v)}` });
    return " ".repeat(trecho.length);
  });
  for (const m of mascarado.matchAll(A_VISTA)) achados.push({ pos: m.index ?? 0, preco: `R$ ${valor(m[1])}` });
  return [...new Set(achados.sort((a, b) => a.pos - b.pos).map((a) => a.preco))];
}

function contar(texto: string): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const p of texto.toLowerCase().split(/\s+/).filter(Boolean)) mapa.set(p, (mapa.get(p) ?? 0) + 1);
  return mapa;
}

/**
 * Fração (0 a 1) de palavras mudadas, sem olhar a ordem: o maior entre as que sumiram
 * e as que surgiram, dividido pelo maior número de palavras das duas versões.
 */
export function fracaoPalavrasMudadas(antes: string, depois: string): number {
  const a = contar(antes);
  const d = contar(depois);
  let sumiram = 0;
  let surgiram = 0;
  for (const [p, n] of a) sumiram += Math.max(0, n - (d.get(p) ?? 0));
  for (const [p, n] of d) surgiram += Math.max(0, n - (a.get(p) ?? 0));
  const total = Math.max([...a.values()].reduce((x, y) => x + y, 0), [...d.values()].reduce((x, y) => x + y, 0));
  return total === 0 ? 0 : Math.max(sumiram, surgiram) / total;
}
