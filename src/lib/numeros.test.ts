import { describe, expect, it } from "vitest";
import { lerNumero } from "./numeros";

describe("lerNumero", () => {
  it("lê formatos brasileiros", () => {
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero("12%")).toBe(12);
    expect(lerNumero("R$ 10")).toBe(10);
    expect(lerNumero("1.200")).toBe(1200);
    expect(lerNumero("1.200.000")).toBe(1200000);
    expect(lerNumero("0.5")).toBe(0.5);
    expect(lerNumero("abc")).toBeNull();
  });
});
