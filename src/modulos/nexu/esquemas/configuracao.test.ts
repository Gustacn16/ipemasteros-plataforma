import { describe, expect, it } from "vitest";
import { esquemaConfiguracaoIa } from "./configuracao";

const base = { modelo: "claude-haiku-5-5", limiteMensalUsd: "20", perguntasPorDia: "50" };

describe("esquemaConfiguracaoIa", () => {
  it("converte dólares em micro-dólares", () => {
    expect(esquemaConfiguracaoIa.parse(base)).toEqual({
      modelo: "claude-haiku-5-5",
      limiteMensalMicroUsd: 20_000_000,
      perguntasPorDia: 50,
    });
  });

  it("aceita centavos, inclusive com vírgula", () => {
    expect(esquemaConfiguracaoIa.parse({ ...base, limiteMensalUsd: "12,34" }).limiteMensalMicroUsd).toBe(12_340_000);
    expect(esquemaConfiguracaoIa.parse({ ...base, limiteMensalUsd: "1000" }).limiteMensalMicroUsd).toBe(1_000_000_000);
  });

  it.each(["0", "1000.01", "0.99", "abc", "", "5.123"])("rejeita limite %s", (limiteMensalUsd) => {
    expect(esquemaConfiguracaoIa.safeParse({ ...base, limiteMensalUsd }).success).toBe(false);
  });

  it("rejeita modelo desconhecido", () => {
    expect(esquemaConfiguracaoIa.safeParse({ ...base, modelo: "gpt-4" }).success).toBe(false);
  });

  it.each(["0", "501", "1.5", ""])("rejeita perguntas por dia %s", (perguntasPorDia) => {
    expect(esquemaConfiguracaoIa.safeParse({ ...base, perguntasPorDia }).success).toBe(false);
  });
});
