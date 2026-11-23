import { describe, expect, it } from "vitest";
import { anoPadrao, mesesDoAcumulado, somarMeses } from "./meses";

describe("somarMeses", () => {
  it("atravessa o ano", () => expect(somarMeses("2027-01", -4)).toBe("2026-09"));
});

describe("anoPadrao", () => {
  it("usa o ano atual quando tem plano", () => expect(anoPadrao([2026, 2027], "2027-03-01")).toBe(2027));
  it("sem plano no ano atual, usa o próximo plano", () => expect(anoPadrao([2027, 2028], "2026-11-23")).toBe(2027));
  it("só planos antigos, usa o último", () => expect(anoPadrao([2025], "2026-11-23")).toBe(2025));
});

describe("mesesDoAcumulado", () => {
  it("deixa de fora o mês em andamento quando já há mês fechado", () => {
    expect(mesesDoAcumulado(["2027-01", "2027-02", "2027-03", "2027-04"], "2027-03", "2027-03-10")).toEqual(["2027-01", "2027-02"]);
  });
  it("no primeiro mês do ano, usa o próprio mês", () => {
    expect(mesesDoAcumulado(["2027-01", "2027-02"], "2027-01", "2027-01-10")).toEqual(["2027-01"]);
  });
  it("mês escolhido no passado vai até ele", () => {
    expect(mesesDoAcumulado(["2027-01", "2027-02", "2027-03"], "2027-02", "2027-05-01")).toEqual(["2027-01", "2027-02"]);
  });
});

describe("anoPadrao sem nenhum plano", () => {
  it("no fim do ano (out–dez) sugere o ano seguinte", () => expect(anoPadrao([], "2026-11-23")).toBe(2027));
  it("no começo do ano sugere o ano atual", () => expect(anoPadrao([], "2027-02-01")).toBe(2027));
});
