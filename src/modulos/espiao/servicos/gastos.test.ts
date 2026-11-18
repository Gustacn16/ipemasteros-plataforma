import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  gastoEspiao: { aggregate: vi.fn(), create: vi.fn() },
  usoIa: { aggregate: vi.fn() },
  config: { modelo: "claude-haiku-5-5", limiteMensalMicroUsd: 20_000_000, perguntasPorDia: 50, limiteEspiaoMicroUsd: 10_000_000 },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { gastoEspiao: m.gastoEspiao, usoIa: m.usoIa } }));
vi.mock("@/lib/ia/configuracao", () => ({ obterConfiguracaoIa: async () => m.config }));
const { gastoEspiaoDoMes, podeGastar, registrarGastoExterno } = await import("./gastos");

const AGORA = new Date("2026-11-18T12:00:00Z");
function gastos(externo: number, iaEspiao: number, iaTotal: number) {
  m.gastoEspiao.aggregate.mockResolvedValue({ _sum: { custoMicroUsd: externo } });
  m.usoIa.aggregate.mockImplementation(async (a: { where: { origem?: string } }) => ({ _sum: { custoMicroUsd: a.where.origem === "espiao" ? iaEspiao : iaTotal } }));
}

beforeEach(() => vi.clearAllMocks());

describe("gastos do espião", () => {
  it("gasto do mês soma serviços externos e o Claude do espião, desde o 1º dia do mês em São Paulo", async () => {
    gastos(300, 700, 5000);
    expect(await gastoEspiaoDoMes(AGORA)).toBe(1000);
    expect(m.gastoEspiao.aggregate.mock.calls[0][0].where.criadoEm.gte.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("teto do espião atingido bloqueia", async () => {
    gastos(4_000_000, 6_000_000, 6_000_000);
    expect(await podeGastar(AGORA)).toEqual({ ok: false, motivo: "teto_espiao" });
  });

  it("limite geral da IA atingido bloqueia o Claude, mas não serviço externo (D6)", async () => {
    gastos(0, 100, 20_000_000);
    expect(await podeGastar(AGORA, "ia")).toEqual({ ok: false, motivo: "limite_geral" });
    expect(await podeGastar(AGORA, "externo")).toEqual({ ok: true });
  });

  it("abaixo dos dois limites, pode gastar", async () => {
    gastos(0, 100, 1000);
    expect(await podeGastar(AGORA)).toEqual({ ok: true });
  });

  it("registra gasto externo com os números", async () => {
    await registrarGastoExterno({ servico: "groq", quantidade: 42, custoMicroUsd: 467, coletaId: "c1", usuarioId: null });
    expect(m.gastoEspiao.create).toHaveBeenCalledWith({ data: { servico: "groq", quantidade: 42, custoMicroUsd: 467, coletaId: "c1", usuarioId: null } });
  });
});
