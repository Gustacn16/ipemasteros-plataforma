import { describe, expect, it } from "vitest";
import { inicioDaSemanaSaoPaulo } from "./semana";

describe("inicioDaSemanaSaoPaulo", () => {
  it("quarta cai na segunda 16/11 (00:00 de São Paulo)", () => {
    expect(inicioDaSemanaSaoPaulo(new Date("2026-11-18T12:00:00Z")).toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
  it("domingo 23:59 em São Paulo ainda é da semana de 16/11", () => {
    expect(inicioDaSemanaSaoPaulo(new Date("2026-11-23T02:59:00Z")).toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
  it("segunda 00:00 em São Paulo começa a semana nova", () => {
    expect(inicioDaSemanaSaoPaulo(new Date("2026-11-23T03:00:00Z")).toISOString()).toBe("2026-11-23T03:00:00.000Z");
  });
});
