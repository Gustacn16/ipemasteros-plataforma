import { nomeBusca } from "@/modulos/academico/regras/normalizar";

/** Todas as palavras do termo aparecem no texto (sem acento e caixa)? */
export function casaBusca(texto: string, termo: string): boolean {
  const alvo = nomeBusca(texto);
  const palavras = nomeBusca(termo).split(" ").filter(Boolean);
  return palavras.length > 0 && palavras.every((p) => alvo.includes(p));
}

/** Trecho de até ~160 caracteres em volta da primeira palavra encontrada. */
export function trechoDaBusca(texto: string, termo: string): string | null {
  const limpo = texto.replace(/[#*_>`[\]()|-]+/g, " ").replace(/\s+/g, " ").trim();
  const normal = nomeBusca(limpo);
  const primeira = nomeBusca(termo).split(" ").find(Boolean);
  if (!primeira) return null;
  const i = normal.indexOf(primeira);
  if (i < 0) return null;
  const inicio = Math.max(0, i - 60);
  const fim = Math.min(limpo.length, i + 100);
  return `${inicio > 0 ? "…" : ""}${limpo.slice(inicio, fim).trim()}${fim < limpo.length ? "…" : ""}`;
}
