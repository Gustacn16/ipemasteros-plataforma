import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({
  create: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn(),
  config: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    usoIa: { create: banco.create, count: banco.count, aggregate: banco.aggregate },
    configuracaoIa: { findUnique: banco.config },
  },
}));

const { registrarUsoIa, situacaoLimites } = await import("./uso");

beforeEach(() => {
  Object.values(banco).forEach((m) => m.mockReset());
});

describe("registrarUsoIa", () => {
  it("grava tokens e custo, sem nenhum campo de texto", async () => {
    banco.create.mockResolvedValue({});
    const custo = await registrarUsoIa({
      origem: "nexu",
      usuarioId: "u1",
      modelo: "claude-sonnet-5-5",
      inicioPergunta: true,
      usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 2000 },
    });
    expect(custo).toBe(7200);
    expect(banco.create).toHaveBeenCalledWith({
      data: {
        origem: "nexu",
        usuarioId: "u1",
        inicioPergunta: true,
        modelo: "claude-sonnet-5-5",
        tokensEntrada: 1000,
        tokensCacheEscrita: 0,
        tokensCacheLeitura: 2000,
        tokensSaida: 500,
        custoMicroUsd: 7200,
      },
    });
  });
});

describe("situacaoLimites", () => {
  it("conta perguntas só do nexu/usuário e soma o gasto de todas as origens", async () => {
    banco.config.mockResolvedValue({ modelo: "claude-haiku-5-5", limiteMensalMicroUsd: 1000, perguntasPorDia: 5 });
    banco.count.mockResolvedValue(2);
    banco.aggregate.mockResolvedValue({ _sum: { custoMicroUsd: 400 } });
    const r = await situacaoLimites("u1", new Date("2026-11-18T01:30:00Z"));
    expect(r).toEqual({ ok: true, restantesHoje: 3 });
    expect(banco.count).toHaveBeenCalledWith({
      where: { origem: "nexu", usuarioId: "u1", inicioPergunta: true, criadoEm: { gte: new Date("2026-11-17T03:00:00.000Z") } },
    });
    expect(banco.aggregate).toHaveBeenCalledWith({
      _sum: { custoMicroUsd: true },
      where: { criadoEm: { gte: new Date("2026-11-01T03:00:00.000Z") } },
    });
  });
  it("sem gasto no mês, soma é zero", async () => {
    banco.config.mockResolvedValue(null);
    banco.count.mockResolvedValue(50);
    banco.aggregate.mockResolvedValue({ _sum: { custoMicroUsd: null } });
    expect(await situacaoLimites("u1")).toEqual({ ok: false, motivo: "dia" });
  });
});
