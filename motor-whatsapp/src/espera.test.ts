import { describe, expect, it } from "vitest";
import { esperaReconexao } from "./espera.ts";

describe("esperaReconexao", () => {
  it("dobra a cada tentativa a partir de 2 s", () => {
    expect(esperaReconexao(0)).toBe(2000);
    expect(esperaReconexao(3)).toBe(16000);
  });

  it("não passa de 5 min", () => {
    expect(esperaReconexao(20)).toBe(300000);
  });
});
