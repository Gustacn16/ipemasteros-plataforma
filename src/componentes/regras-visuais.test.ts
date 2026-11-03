import { describe, expect, it } from "vitest";
import { faixaDoPercentual, textoVariacao } from "./regras-visuais";

describe("faixaDoPercentual", () => {
  it("classifica as faixas", () => {
    expect(faixaDoPercentual(100)).toBe("sucesso");
    expect(faixaDoPercentual(80)).toBe("sucesso");
    expect(faixaDoPercentual(79)).toBe("atencao");
    expect(faixaDoPercentual(60)).toBe("atencao");
    expect(faixaDoPercentual(59)).toBe("perigo");
    expect(faixaDoPercentual(0)).toBe("perigo");
  });
  it("devolve null sem valor", () => {
    expect(faixaDoPercentual(null)).toBeNull();
  });
});

describe("textoVariacao", () => {
  it("alta, queda e igual", () => {
    expect(textoVariacao(12)).toEqual({ texto: "↑ 12%", tom: "sucesso" });
    expect(textoVariacao(-8)).toEqual({ texto: "↓ 8%", tom: "perigo" });
    expect(textoVariacao(0)).toEqual({ texto: "=", tom: "neutro" });
  });
  it("trata -0 como igual", () => {
    expect(textoVariacao(-0)).toEqual({ texto: "=", tom: "neutro" });
  });
  it("devolve null sem base", () => {
    expect(textoVariacao(null)).toBeNull();
  });
});
