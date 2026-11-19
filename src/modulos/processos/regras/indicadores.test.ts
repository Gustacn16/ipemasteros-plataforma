import { describe, expect, it } from "vitest";
import { bateuMeta, formatarValor, inicioDoPeriodo, lerNumero, periodoAnterior, rotuloPeriodo, situacaoIndicador } from "./indicadores";

describe("períodos", () => {
  it("semana começa na segunda", () => {
    expect(inicioDoPeriodo("2026-11-19", "semanal")).toBe("2026-11-16"); // quinta → segunda
    expect(inicioDoPeriodo("2026-11-22", "semanal")).toBe("2026-11-16"); // domingo
  });
  it("mês e trimestre", () => {
    expect(inicioDoPeriodo("2026-11-19", "mensal")).toBe("2026-11-01");
    expect(inicioDoPeriodo("2026-11-19", "trimestral")).toBe("2026-10-01");
    expect(periodoAnterior("2026-01-01", "mensal")).toBe("2025-12-01");
    expect(periodoAnterior("2026-01-01", "trimestral")).toBe("2025-10-01");
    expect(periodoAnterior("2026-11-16", "semanal")).toBe("2026-11-09");
  });
  it("rótulos", () => {
    expect(rotuloPeriodo("2026-11-01", "mensal")).toBe("nov/2026");
    expect(rotuloPeriodo("2026-10-01", "trimestral")).toBe("4º tri 2026");
    expect(rotuloPeriodo("2026-11-16", "semanal")).toBe("Semana de 16/11/2026");
  });
});

describe("farol", () => {
  it("respeita o sentido do indicador", () => {
    expect(bateuMeta(10, 8, "maior_melhor")).toBe(true);
    expect(bateuMeta(10, 8, "menor_melhor")).toBe(false);
    expect(bateuMeta(8, 8, "menor_melhor")).toBe(true);
    expect(bateuMeta(8, null, "menor_melhor")).toBeNull();
  });

  it("situação considera atraso do período fechado", () => {
    const ind = { frequencia: "mensal" as const, sentido: "maior_melhor" as const };
    expect(situacaoIndicador(null, ind, "2026-11-19")).toBe("sem_medicao");
    expect(situacaoIndicador({ periodo: "2026-09-01", valor: 1, meta: 0 }, ind, "2026-11-19")).toBe("atrasado");
    expect(situacaoIndicador({ periodo: "2026-10-01", valor: 1, meta: 2 }, ind, "2026-11-19")).toBe("fora_da_meta");
    expect(situacaoIndicador({ periodo: "2026-11-01", valor: 3, meta: 2 }, ind, "2026-11-19")).toBe("na_meta");
    expect(situacaoIndicador({ periodo: "2026-11-01", valor: 3, meta: null }, ind, "2026-11-19")).toBe("sem_meta");
  });
});

describe("números", () => {
  it("lê formatos brasileiros", () => {
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero("12%")).toBe(12);
    expect(lerNumero("R$ 10")).toBe(10);
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("1.200")).toBe(1200);
    expect(lerNumero("1.200.000")).toBe(1200000);
    expect(lerNumero("0.5")).toBe(0.5);
  });
  it("formata por unidade", () => {
    expect(formatarValor(12.5, "%")).toBe("12,5%");
    expect(formatarValor(42, "leads")).toBe("42 leads");
    expect(formatarValor(1200, "R$")).toMatch(/R\$\s1\.200,00/);
  });
});
