import { describe, expect, it } from "vitest";
import { formatarReais, lerReais, mascararReais } from "./dinheiro";

describe("lerReais", () => {
  it.each([
    ["3.300,00", "3300.00"],
    ["R$ 1.000", "1000.00"],
    ["11264", "11264.00"],
    ["1234,5", "1234.50"],
    ["1234.56", "1234.56"],
    ["0", "0.00"],
    ["  R$ 20.000,00 ", "20000.00"],
    ["1.234.567,89", "1234567.89"],
  ])("%s vira %s", (entrada, saida) => {
    expect(lerReais(entrada)).toBe(saida);
  });

  it.each(["", "abc", "1,2,3", "-5", "1.2.3,4,5", "12,345", "R$"])("%s é inválido", (entrada) => {
    expect(lerReais(entrada)).toBeNull();
  });
});

describe("formatarReais", () => {
  it("formata no padrão brasileiro com espaço comum", () => {
    expect(formatarReais("3300.00")).toBe("R$ 3.300,00");
    expect(formatarReais(0)).toBe("R$ 0,00");
    expect(formatarReais("72000")).toBe("R$ 72.000,00");
  });
});

describe("mascararReais", () => {
  it.each([
    ["", ""],
    ["5", "R$ 5"],
    ["1234", "R$ 1.234"],
    ["1234567", "R$ 1.234.567"],
    ["R$ 1.2345", "R$ 12.345"],
    ["1234,", "R$ 1.234,"],
    ["1234,5", "R$ 1.234,5"],
    ["1234,567", "R$ 1.234,56"],
    ["1,2,3", "R$ 1,23"],
    ["007", "R$ 7"],
    ["0,5", "R$ 0,5"],
    [",5", "R$ 0,5"],
    ["abc", ""],
  ])("%s → %s", (entrada, saida) => expect(mascararReais(entrada)).toBe(saida));

  it("o resultado é lido de volta pelo servidor", () => {
    expect(lerReais(mascararReais("1234567,8"))).toBe("1234567.80");
    expect(lerReais(mascararReais("15000"))).toBe("15000.00");
  });
});
