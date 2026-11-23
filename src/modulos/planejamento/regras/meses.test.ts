import { describe, expect, it } from "vitest";
import { anoPadrao, somarMeses } from "./meses";

describe("somarMeses", () => {
  it("atravessa o ano", () => expect(somarMeses("2027-01", -4)).toBe("2026-09"));
});

describe("anoPadrao", () => {
  it("usa o ano atual quando tem plano", () => expect(anoPadrao([2026, 2027], "2027-03-01")).toBe(2027));
  it("sem plano no ano atual, usa o próximo plano", () => expect(anoPadrao([2027, 2028], "2026-11-23")).toBe(2027));
  it("só planos antigos, usa o último", () => expect(anoPadrao([2025], "2026-11-23")).toBe(2025));
  it("sem planos, o ano atual", () => expect(anoPadrao([], "2026-11-23")).toBe(2026));
});
