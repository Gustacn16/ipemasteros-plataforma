import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  versoes: [] as { id: string; paginaId: string; capturadaEm: Date }[],
  sinais: [] as { id: string; criadoEm: Date }[],
  fotos: [] as { id: string; capturadaEm: Date }[],
}));
const antesDe = (lista: { capturadaEm?: Date; criadoEm?: Date }[], lt: Date) => lista.filter((x) => (x.capturadaEm ?? x.criadoEm)! < lt);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    versaoPagina: {
      findMany: vi.fn(async (a: { where: { capturadaEm?: { lt: Date }; paginaId?: { in: string[] } } }) => {
        if (a.where.capturadaEm) return antesDe(m.versoes, a.where.capturadaEm.lt);
        return m.versoes.filter((v) => a.where.paginaId!.in.includes(v.paginaId));
      }),
      deleteMany: vi.fn(async (a: { where: { id: { in: string[] } } }) => {
        const antes = m.versoes.length;
        m.versoes = m.versoes.filter((v) => !a.where.id.in.includes(v.id));
        return { count: antes - m.versoes.length };
      }),
    },
    sinalEspiao: {
      deleteMany: vi.fn(async (a: { where: { criadoEm: { lt: Date } } }) => {
        const antes = m.sinais.length;
        m.sinais = m.sinais.filter((s) => s.criadoEm >= a.where.criadoEm.lt);
        return { count: antes - m.sinais.length };
      }),
    },
    fotoInstagram: {
      deleteMany: vi.fn(async (a: { where: { capturadaEm: { lt: Date } } }) => {
        const antes = m.fotos.length;
        m.fotos = m.fotos.filter((f) => f.capturadaEm >= a.where.capturadaEm.lt);
        return { count: antes - m.fotos.length };
      }),
    },
  },
}));
const { limparEspiaoAntigo } = await import("./limpeza");

const AGORA = new Date("2026-11-18T12:00:00Z");
const mesesAtras = (n: number, dias = 0) => new Date(AGORA.getTime() - (n * 30.5 + dias) * 86_400_000);

beforeEach(() => {
  m.versoes = [
    { id: "v1", paginaId: "p1", capturadaEm: mesesAtras(20, 2) },
    { id: "v2", paginaId: "p1", capturadaEm: mesesAtras(20, 1) },
    { id: "v3", paginaId: "p1", capturadaEm: mesesAtras(20) },
  ];
  m.sinais = [
    { id: "s1", criadoEm: mesesAtras(19) },
    { id: "s2", criadoEm: mesesAtras(17) },
  ];
  m.fotos = [{ id: "f1", capturadaEm: mesesAtras(19) }];
});

describe("limparEspiaoAntigo", () => {
  it("apaga o que passou de 18 meses e mantém a versão mais recente de cada página", async () => {
    const r = await limparEspiaoAntigo(AGORA);
    expect(m.versoes.map((v) => v.id)).toEqual(["v3"]);
    expect(m.sinais.map((s) => s.id)).toEqual(["s2"]);
    expect(m.fotos).toEqual([]);
    expect(r).toEqual({ versoes: 2, fotos: 1, sinais: 1 });
  });
});
