import { describe, expect, it } from "vitest";
import { atalhoDoBloco, lerBlocos, escreverBlocos } from "./blocos";

const semId = (texto: string | null) => lerBlocos(texto).map((b) => ({ tipo: b.tipo, texto: b.texto, feito: b.feito }));

describe("lerBlocos", () => {
  it("lê título, lista, checklist, divisória e texto", () => {
    expect(semId("# Gancho\n- ponto 1\n- [ ] gravar b-roll\n- [x] roteiro\n---\nTexto livre")).toEqual([
      { tipo: "titulo", texto: "Gancho", feito: false },
      { tipo: "lista", texto: "ponto 1", feito: false },
      { tipo: "tarefa", texto: "gravar b-roll", feito: false },
      { tipo: "tarefa", texto: "roteiro", feito: true },
      { tipo: "divisoria", texto: "", feito: false },
      { tipo: "texto", texto: "Texto livre", feito: false },
    ]);
  });
  it("roteiro antigo (texto corrido) vira blocos de texto, linha por linha", () => {
    expect(semId("Abrir com a pergunta\n\nFechar com CTA").map((b) => [b.tipo, b.texto])).toEqual([
      ["texto", "Abrir com a pergunta"],
      ["texto", ""],
      ["texto", "Fechar com CTA"],
    ]);
  });
  it("vazio vira um bloco de texto vazio, pronto para escrever", () => {
    expect(semId(null)).toEqual([{ tipo: "texto", texto: "", feito: false }]);
  });
  it("cada bloco tem um id diferente", () => {
    const ids = lerBlocos("a\nb\nc").map((b) => b.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe("escreverBlocos", () => {
  it("volta ao mesmo texto", () => {
    const texto = "# Gancho\n- ponto 1\n- [ ] gravar b-roll\n- [x] roteiro\n---\nTexto livre";
    expect(escreverBlocos(lerBlocos(texto))).toBe(texto);
  });
  it("só blocos vazios vira null", () => {
    expect(escreverBlocos(lerBlocos("\n\n"))).toBeNull();
    expect(escreverBlocos(lerBlocos(null))).toBeNull();
  });
  it("tira linhas vazias do fim", () => {
    expect(escreverBlocos(lerBlocos("a\n\n"))).toBe("a");
  });
});

describe("atalhoDoBloco", () => {
  it("atalhos de Markdown no começo de um bloco de texto", () => {
    expect(atalhoDoBloco("# Título")).toEqual({ tipo: "titulo", texto: "Título" });
    expect(atalhoDoBloco("- item")).toEqual({ tipo: "lista", texto: "item" });
    expect(atalhoDoBloco("* item")).toEqual({ tipo: "lista", texto: "item" });
    expect(atalhoDoBloco("[] tarefa")).toEqual({ tipo: "tarefa", texto: "tarefa" });
    expect(atalhoDoBloco("[ ] tarefa")).toEqual({ tipo: "tarefa", texto: "tarefa" });
    expect(atalhoDoBloco("---")).toEqual({ tipo: "divisoria", texto: "" });
    expect(atalhoDoBloco("texto normal")).toBeNull();
    expect(atalhoDoBloco("-sem espaço")).toBeNull();
  });
});
