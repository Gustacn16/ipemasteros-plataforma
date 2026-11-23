import { describe, expect, it } from "vitest";
import { acumular, desempenho, razaoAcumulada, statusDe } from "./desempenho";

describe("desempenho", () => {
  it("maior é melhor: realizado ÷ meta", () => expect(desempenho(190, 190, "maior_melhor")).toBe(1));
  it("menor é melhor: meta ÷ realizado", () => expect(desempenho(6000, 6179, "menor_melhor")).toBeCloseTo(1.0298, 4));
  it("meta zero ou vazia não tem desempenho", () => {
    expect(desempenho(5, 0, "maior_melhor")).toBeNull();
    expect(desempenho(5, null, "maior_melhor")).toBeNull();
  });
  it("sem realizado não tem desempenho", () => expect(desempenho(null, 10, "maior_melhor")).toBeNull());
  it("menor é melhor com realizado zero fica vazio", () => expect(desempenho(0, 6179, "menor_melhor")).toBeNull());
});

describe("statusDe", () => {
  it("usa ✔ ≥ 100%, ⚠ 80–99%, ✖ < 80%", () => {
    expect(statusDe(1)).toBe("ok");
    expect(statusDe(0.8)).toBe("atencao");
    expect(statusDe(0.7999)).toBe("ruim");
    expect(statusDe(null)).toBeNull();
  });
});

describe("acumular", () => {
  it("fluxo soma os meses", () => {
    expect(
      acumular("fluxo", [
        { mes: "2027-01", meta: 10, realizado: 8 },
        { mes: "2027-02", meta: 10, realizado: null },
      ]),
    ).toEqual({ meta: 20, realizado: 8 });
  });
  it("fluxo sem nenhum dado fica vazio", () => {
    expect(acumular("fluxo", [{ mes: "2027-01", meta: 10, realizado: null }])).toEqual({ meta: 10, realizado: null });
  });
  it("estoque usa o último mês com dado e a meta desse mês", () => {
    expect(
      acumular("estoque", [
        { mes: "2027-01", meta: 1000, realizado: 900 },
        { mes: "2027-02", meta: 1100, realizado: null },
      ]),
    ).toEqual({ meta: 1000, realizado: 900 });
  });
  it("taxa tira a média dos meses com dado", () => {
    expect(
      acumular("taxa", [
        { mes: "2027-01", meta: 0.35, realizado: 0.3 },
        { mes: "2027-02", meta: 0.35, realizado: 0.4 },
      ]),
    ).toEqual({ meta: 0.35, realizado: 0.35 });
  });
});

describe("razaoAcumulada", () => {
  it("soma numeradores e denominadores antes de dividir (CAC e conversão do ano)", () => {
    expect(razaoAcumulada([{ num: 10, den: 100 }, { num: 0, den: 300 }])).toBe(0.025);
  });
  it("sem denominador fica vazio", () => expect(razaoAcumulada([{ num: 5, den: 0 }])).toBeNull());
});
