import { describe, expect, it } from "vitest";
import { ancoraDoTitulo, extrairSumario, vizinhos } from "./sumario";

describe("sumário", () => {
  it("pega ## e ### fora de blocos de código, sem marcação", () => {
    const md = "## Missão\ntexto\n### **Valores** da [IPE](http://x)\n```\n## não é título\n```\n# Visão";
    expect(extrairSumario(md)).toEqual([
      { nivel: 2, texto: "Missão", id: "s-missao" },
      { nivel: 3, texto: "Valores da IPE", id: "s-valores-da-ipe" },
      { nivel: 2, texto: "Visão", id: "s-visao" },
    ]);
  });
  it("âncora sem acento e sem símbolos", () => {
    expect(ancoraDoTitulo("1. Padrão (a ficha)")).toBe("s-1-padrao-a-ficha");
    expect(ancoraDoTitulo("???")).toBe("s-secao");
  });
  it("anterior e próximo", () => {
    const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(vizinhos(l, "b")).toEqual({ anterior: { id: "a" }, proximo: { id: "c" } });
    expect(vizinhos(l, "a").anterior).toBeNull();
    expect(vizinhos(l, "x")).toEqual({ anterior: null, proximo: null });
  });
});
