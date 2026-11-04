import { describe, expect, it } from "vitest";
import { cobreResumo, contarNoIntervalo, fimDoResumo } from "./resumo";

const item = (inicio: string, fim = inicio) => ({ inicio, fim });

describe("contarNoIntervalo", () => {
  const itens = [
    item("2026-11-04"),
    item("2026-11-04"),
    item("2026-11-02", "2026-11-05"), // começou antes e passa por hoje
    item("2026-11-10"), // dentro dos 7 dias
    item("2026-11-11"), // fora (hoje + 7)
    item("2026-10-30", "2026-11-03"), // terminou ontem
  ];

  it("conta os itens de um dia, inclusive os de vários dias que o cobrem", () => {
    expect(contarNoIntervalo(itens, "2026-11-04", "2026-11-04")).toBe(3);
  });
  it("conta os itens que tocam o intervalo, uma vez cada", () => {
    expect(contarNoIntervalo(itens, "2026-11-04", "2026-11-10")).toBe(4);
  });
  it("evento que atravessa o ano conta nos dois lados", () => {
    const virada = [item("2026-12-30", "2027-01-02")];
    expect(contarNoIntervalo(virada, "2026-12-31", "2026-12-31")).toBe(1);
    expect(contarNoIntervalo(virada, "2027-01-02", "2027-01-08")).toBe(1);
    expect(contarNoIntervalo(virada, "2027-01-03", "2027-01-09")).toBe(0);
  });
  it("lista vazia é zero", () => {
    expect(contarNoIntervalo([], "2026-11-04", "2026-11-10")).toBe(0);
  });
});

describe("fimDoResumo e cobreResumo", () => {
  it("o resumo vai de hoje a hoje + 6", () => {
    expect(fimDoResumo("2026-12-28")).toBe("2027-01-03");
  });
  it("o mês atual cobre; outro mês ou o fim do mês não cobrem", () => {
    expect(cobreResumo({ de: "2026-11-01", ate: "2026-12-05" }, "2026-11-04")).toBe(true);
    expect(cobreResumo({ de: "2026-11-01", ate: "2026-12-05" }, "2026-11-29")).toBe(true);
    expect(cobreResumo({ de: "2026-11-01", ate: "2026-12-05" }, "2026-11-30")).toBe(false);
    expect(cobreResumo({ de: "2026-11-01", ate: "2026-12-05" }, "2026-12-01")).toBe(false);
    expect(cobreResumo({ de: "2026-12-27", ate: "2027-02-06" }, "2026-11-04")).toBe(false);
  });
  it("a semana só cobre se hoje for domingo", () => {
    expect(cobreResumo({ de: "2026-11-01", ate: "2026-11-07" }, "2026-11-01")).toBe(true);
    expect(cobreResumo({ de: "2026-11-01", ate: "2026-11-07" }, "2026-11-04")).toBe(false);
  });
});
