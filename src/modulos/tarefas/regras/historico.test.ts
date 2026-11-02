import { describe, expect, it } from "vitest";
import { descreverMudanca, mudancasDaTarefa } from "./historico";

const base = { prioridade: "normal" as const, dataInicio: null, dataEntrega: "2026-11-27", responsaveis: ["Arthur", "Bia"] };

describe("mudancasDaTarefa", () => {
  it("sem mudança não gera linha (ordem dos responsáveis não importa)", () => {
    expect(mudancasDaTarefa(base, { ...base, responsaveis: ["Bia", "Arthur"] })).toEqual([]);
  });

  it("registra cada campo alterado", () => {
    const depois = { prioridade: "urgente" as const, dataInicio: "2026-11-20", dataEntrega: null, responsaveis: ["Bia"] };
    expect(mudancasDaTarefa(base, depois)).toEqual([
      { campo: "prioridade", valorAntes: "normal", valorDepois: "urgente" },
      { campo: "dataInicio", valorAntes: null, valorDepois: "2026-11-20" },
      { campo: "dataEntrega", valorAntes: "2026-11-27", valorDepois: null },
      { campo: "responsaveis", valorAntes: ["Arthur", "Bia"], valorDepois: ["Bia"] },
    ]);
  });
});

describe("descreverMudanca", () => {
  it("escreve frases em português", () => {
    expect(descreverMudanca({ campo: "status", valorAntes: "A fazer", valorDepois: "Concluído" })).toBe("moveu de A fazer para Concluído");
    expect(descreverMudanca({ campo: "dataEntrega", valorAntes: "2026-11-27", valorDepois: null })).toBe(
      "mudou a entrega de 27/11/2026 para sem data",
    );
    expect(descreverMudanca({ campo: "prioridade", valorAntes: "normal", valorDepois: "urgente" })).toBe(
      "mudou a prioridade de Normal para Urgente",
    );
    expect(descreverMudanca({ campo: "responsaveis", valorAntes: [], valorDepois: ["Bia"] })).toBe(
      "mudou os responsáveis de ninguém para Bia",
    );
  });
});
