import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { booleanoDaAcao, idDaAcao } = await import("./acoes");

describe("argumentos soltos de Server Action", () => {
  it("aceita id em texto", () => {
    expect(idDaAcao("clx123")).toBe("clx123");
  });

  it("recusa objeto no lugar do id (seria lido como filtro pelo Prisma)", () => {
    expect(() => idDaAcao({ not: "" })).toThrow();
    expect(() => idDaAcao({ in: ["a", "b"] })).toThrow();
    expect(() => idDaAcao("")).toThrow();
    expect(() => idDaAcao(undefined)).toThrow();
  });

  it("aceita só booleano de verdade", () => {
    expect(booleanoDaAcao(true)).toBe(true);
    expect(booleanoDaAcao(false)).toBe(false);
    expect(() => booleanoDaAcao("false")).toThrow();
  });
});
