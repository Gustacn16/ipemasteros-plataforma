import { describe, expect, it } from "vitest";
import { agruparPorDia, rotuloDia } from "./inicio";

describe("rotuloDia", () => {
  it("usa Hoje e Amanhã", () => {
    expect(rotuloDia("2026-11-02", "2026-11-02")).toBe("Hoje");
    expect(rotuloDia("2026-11-03", "2026-11-02")).toBe("Amanhã");
  });
  it("mostra dia da semana e data nos demais", () => {
    expect(rotuloDia("2026-11-05", "2026-11-02")).toMatch(/qui.*5.*nov/);
  });
  it("vira o mês", () => {
    expect(rotuloDia("2026-12-01", "2026-11-30")).toBe("Amanhã");
  });
});

describe("agruparPorDia", () => {
  it("ordena por dia e põe em Hoje o evento que já começou", () => {
    const grupos = agruparPorDia(
      [
        { id: "b", dataInicio: "2026-11-04" },
        { id: "a", dataInicio: "2026-10-30" },
        { id: "c", dataInicio: "2026-11-02" },
      ],
      "2026-11-02",
    );
    expect(grupos.map((g) => [g.dia, g.itens.map((i) => i.id)])).toEqual([
      ["2026-11-02", ["a", "c"]],
      ["2026-11-04", ["b"]],
    ]);
  });
  it("lista vazia não tem grupos", () => {
    expect(agruparPorDia([], "2026-11-02")).toEqual([]);
  });
});
