// Editor livre das anotações (estilo Notion). Os blocos são guardados como Markdown simples no campo
// `roteiro`, então o roteiro antigo (texto corrido) continua aparecendo, como blocos de texto.

export const TIPOS_BLOCO = ["texto", "titulo", "lista", "tarefa", "divisoria"] as const;
export type TipoBloco = (typeof TIPOS_BLOCO)[number];
export type Bloco = { id: string; tipo: TipoBloco; texto: string; feito: boolean };

export const ROTULO_BLOCO: Record<TipoBloco, string> = {
  texto: "Texto",
  titulo: "Título",
  lista: "Lista",
  tarefa: "Checklist",
  divisoria: "Divisória",
};

let sequencia = 0;
export const novoIdBloco = () => `b${Date.now().toString(36)}${(sequencia++).toString(36)}`;
export const novoBloco = (tipo: TipoBloco = "texto", texto = ""): Bloco => ({ id: novoIdBloco(), tipo, texto, feito: false });

function lerLinha(linha: string): Omit<Bloco, "id"> {
  const tarefa = /^[-*] \[( |x|X)\] ?(.*)$/.exec(linha);
  if (tarefa) return { tipo: "tarefa", texto: tarefa[2]!, feito: tarefa[1] !== " " };
  if (/^-{3,}\s*$/.test(linha)) return { tipo: "divisoria", texto: "", feito: false };
  const titulo = /^#{1,3} (.*)$/.exec(linha);
  if (titulo) return { tipo: "titulo", texto: titulo[1]!, feito: false };
  const lista = /^[-*] (.*)$/.exec(linha);
  if (lista) return { tipo: "lista", texto: lista[1]!, feito: false };
  return { tipo: "texto", texto: linha, feito: false };
}

/** Texto guardado → blocos. Vazio vira um bloco de texto vazio. */
export function lerBlocos(texto: string | null): Bloco[] {
  if (!texto) return [novoBloco()];
  return texto.replace(/\r\n/g, "\n").split("\n").map((l) => ({ id: novoIdBloco(), ...lerLinha(l) }));
}

function escreverBloco(b: Bloco): string {
  switch (b.tipo) {
    case "titulo":
      return `# ${b.texto}`;
    case "lista":
      return `- ${b.texto}`;
    case "tarefa":
      return `- [${b.feito ? "x" : " "}] ${b.texto}`;
    case "divisoria":
      return "---";
    default:
      return b.texto;
  }
}

/** Blocos → texto guardado. Sem nada escrito vira `null`. */
export function escreverBlocos(blocos: Bloco[]): string | null {
  const texto = blocos.map(escreverBloco).join("\n").replace(/\n+$/, "");
  return texto.trim() ? texto : null;
}

/** Atalho de Markdown digitado no começo de um bloco de texto ("# ", "- ", "[] ", "---"). */
export function atalhoDoBloco(texto: string): { tipo: TipoBloco; texto: string } | null {
  if (/^-{3,}$/.test(texto)) return { tipo: "divisoria", texto: "" };
  const tarefa = /^\[ ?\] (.*)$/.exec(texto);
  if (tarefa) return { tipo: "tarefa", texto: tarefa[1]! };
  const titulo = /^# (.*)$/.exec(texto);
  if (titulo) return { tipo: "titulo", texto: titulo[1]! };
  const lista = /^[-*] (.*)$/.exec(texto);
  if (lista) return { tipo: "lista", texto: lista[1]! };
  return null;
}
