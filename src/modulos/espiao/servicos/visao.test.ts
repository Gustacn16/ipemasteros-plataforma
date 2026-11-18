import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  coletaEspiao: { findMany: vi.fn() },
  sinalEspiao: { findMany: vi.fn(), count: vi.fn() },
  relatorioEspiao: { findFirst: vi.fn() },
  concorrente: { findMany: vi.fn() },
  usuario: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: m }));
const { contarSinaisNovos, visaoSemana } = await import("./visao");

const gestor = { id: "g1", papel: "gestor" } as never;
const colaborador = { id: "c1", papel: "colaborador" } as never;
const AGORA = new Date("2026-11-18T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  m.coletaEspiao.findMany.mockResolvedValue([
    { id: "k3", status: "concluida", iniciadaEm: new Date("2026-11-18T10:00:00Z"), finalizadaEm: new Date("2026-11-18T10:30:00Z") },
    { id: "k2", status: "parcial", iniciadaEm: new Date("2026-11-16T07:00:00Z"), finalizadaEm: new Date("2026-11-16T07:20:00Z") },
    { id: "k1", status: "concluida", iniciadaEm: new Date("2026-11-09T07:00:00Z"), finalizadaEm: new Date("2026-11-09T07:20:00Z") },
  ]);
  m.sinalEspiao.findMany.mockResolvedValue([]);
  m.relatorioEspiao.findFirst.mockResolvedValue({ analise: "## O que mudou" });
  m.concorrente.findMany.mockResolvedValue([]);
});

describe("visaoSemana", () => {
  it("exige espiao:ver", async () => {
    await expect(visaoSemana(colaborador, undefined, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("lista as semanas e usa as coletas da semana pedida (ou da mais recente)", async () => {
    const v = await visaoSemana(gestor, undefined, AGORA);
    expect(v.semana).toBe("2026-11-16");
    expect(v.semanasDisponiveis).toEqual(["2026-11-16", "2026-11-09"]);
    expect(m.sinalEspiao.findMany.mock.calls[0][0].where).toEqual({ coletaId: { in: ["k3", "k2"] } });
    expect(v.ultimaColeta?.id).toBe("k3");
  });

  it("a análise é a da coleta mais recente da semana que tem relatório", async () => {
    await visaoSemana(gestor, "2026-11-16", AGORA);
    expect(m.relatorioEspiao.findFirst.mock.calls[0][0]).toMatchObject({ where: { coletaId: { in: ["k3", "k2"] } }, orderBy: { coleta: { iniciadaEm: "desc" } } });
  });

  it("semana pedida que não existe cai na mais recente", async () => {
    expect((await visaoSemana(gestor, "2020-01-06", AGORA)).semana).toBe("2026-11-16");
  });
});

describe("contarSinaisNovos", () => {
  it("conta desde a última visita", async () => {
    const visto = new Date("2026-11-17T00:00:00Z");
    m.usuario.findUnique.mockResolvedValue({ espiaoVistoEm: visto });
    m.sinalEspiao.count.mockResolvedValue(4);
    await expect(contarSinaisNovos("g1", AGORA)).resolves.toBe(4);
    expect(m.sinalEspiao.count.mock.calls[0][0].where).toEqual({ criadoEm: { gt: visto } });
  });

  it("sem visita, conta os da semana atual", async () => {
    m.usuario.findUnique.mockResolvedValue({ espiaoVistoEm: null });
    m.sinalEspiao.count.mockResolvedValue(2);
    await contarSinaisNovos("g1", AGORA);
    expect(m.sinalEspiao.count.mock.calls[0][0].where.criadoEm.gt.toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });
});
