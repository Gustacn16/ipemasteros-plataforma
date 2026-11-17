import { describe, expect, it } from "vitest";
import { calcularCustoMicroUsd, tokensDoUsage } from "./precos";

const zero = { entrada: 0, cacheEscrita: 0, cacheLeitura: 0, saida: 0 };

describe("calcularCustoMicroUsd", () => {
  it("Haiku: até 100 mil tokens de entrada usa a faixa de baixo (limite incluído)", () => {
    expect(calcularCustoMicroUsd("claude-haiku-5-5", { ...zero, entrada: 100_000 })).toBe(10_000);
  });

  it("Haiku: 1 milhão de tokens de entrada usa a faixa de cima", () => {
    expect(calcularCustoMicroUsd("claude-haiku-5-5", { ...zero, entrada: 1_000_000 })).toBe(500_000);
  });

  it("Haiku: soma entrada e saída na faixa de baixo", () => {
    expect(calcularCustoMicroUsd("claude-haiku-5-5", { ...zero, entrada: 10_000, saida: 1_000 })).toBe(1_500);
  });

  it("Haiku: acima de 100 mil tokens de entrada (com cache) usa a faixa de cima", () => {
    expect(calcularCustoMicroUsd("claude-haiku-5-5", { ...zero, entrada: 60_000, cacheLeitura: 50_000 })).toBe(32_500);
  });

  it("Opus: arredonda para cima", () => {
    expect(calcularCustoMicroUsd("claude-opus-5-5", { ...zero, saida: 1 })).toBe(20);
    expect(calcularCustoMicroUsd("claude-haiku-5-5", { ...zero, cacheLeitura: 1 })).toBe(1);
  });

  it("Sonnet: escrita de cache custa 1,25 vezes a entrada", () => {
    expect(calcularCustoMicroUsd("claude-sonnet-5-5", { ...zero, cacheEscrita: 1_000_000 })).toBe(2_500_000);
  });
});

describe("tokensDoUsage", () => {
  it("troca null e undefined por 0", () => {
    expect(
      tokensDoUsage({ input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: null, cache_read_input_tokens: undefined }),
    ).toEqual({ entrada: 10, cacheEscrita: 0, cacheLeitura: 0, saida: 5 });
  });

  it("mantém os valores informados", () => {
    expect(tokensDoUsage({ input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 })).toEqual({
      entrada: 1,
      cacheEscrita: 3,
      cacheLeitura: 4,
      saida: 2,
    });
  });
});
