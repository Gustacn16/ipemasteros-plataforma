import { nomeBusca } from "@/modulos/academico/regras/normalizar";

// Links entre documentos: `[[Título do documento]]` no texto vira link.

const PADRAO = /\[\[([^\[\]\n]{1,150})\]\]/g;

export const chaveTitulo = (titulo: string) => nomeBusca(titulo);

/** Títulos citados no texto, sem repetição (comparando sem acento e caixa). */
export function extrairLigacoes(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const vistos = new Map<string, string>();
  for (const m of texto.matchAll(PADRAO)) {
    const titulo = m[1]!.trim();
    if (titulo && !vistos.has(chaveTitulo(titulo))) vistos.set(chaveTitulo(titulo), titulo);
  }
  return [...vistos.values()];
}

export const HREF_SEM_DOCUMENTO = "#sem-documento";

/** Troca cada `[[Título]]` por um link Markdown; o que não achar vira link marcado como ausente. */
export function substituirLigacoes(texto: string, resolver: (titulo: string) => string | null): string {
  return texto.replace(PADRAO, (_, bruto: string) => {
    const titulo = bruto.trim();
    const id = resolver(titulo);
    const rotulo = titulo.replace(/[[\]]/g, "");
    return id ? `[${rotulo}](/processos/documentos/${id})` : `[${rotulo}](${HREF_SEM_DOCUMENTO})`;
  });
}
