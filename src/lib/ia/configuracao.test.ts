import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ linha: null as unknown, findUnique: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoIa: { findUnique: banco.findUnique } } }));

const { obterConfiguracaoIa } = await import("./configuracao");

beforeEach(() => {
  banco.findUnique.mockReset();
  banco.findUnique.mockImplementation(async () => banco.linha);
});

describe("obterConfiguracaoIa", () => {
  it("sem linha, devolve os padrões", async () => {
    banco.linha = null;
    expect(await obterConfiguracaoIa()).toEqual({ modelo: "claude-haiku-5-5", limiteMensalMicroUsd: 20_000_000, perguntasPorDia: 50, limiteEspiaoMicroUsd: 10_000_000 });
    expect(banco.findUnique).toHaveBeenCalledWith({ where: { id: "unica" } });
  });
  it("modelo desconhecido cai para o haiku", async () => {
    banco.linha = { id: "unica", modelo: "modelo-antigo", limiteMensalMicroUsd: 5_000_000, perguntasPorDia: 10, limiteEspiaoMicroUsd: 3_000_000 };
    expect(await obterConfiguracaoIa()).toEqual({ modelo: "claude-haiku-5-5", limiteMensalMicroUsd: 5_000_000, perguntasPorDia: 10, limiteEspiaoMicroUsd: 3_000_000 });
  });
  it("usa o que está salvo quando válido", async () => {
    banco.linha = { id: "unica", modelo: "claude-opus-5-5", limiteMensalMicroUsd: 1, perguntasPorDia: 2 };
    expect((await obterConfiguracaoIa()).modelo).toBe("claude-opus-5-5");
  });
});
