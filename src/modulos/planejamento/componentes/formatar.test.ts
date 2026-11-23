import { describe, expect, it } from "vitest";
import { numeroParaCampo } from "./formatar";

describe("numeroParaCampo", () => {
  it("não mostra resto de ponto flutuante", () => {
    expect(numeroParaCampo(0.07 * 100)).toBe("7");
    expect(numeroParaCampo(0.29 * 100)).toBe("29");
  });
  it("usa vírgula decimal", () => expect(numeroParaCampo(35.5)).toBe("35,5"));
  it("vazio para null", () => expect(numeroParaCampo(null)).toBe(""));
});
