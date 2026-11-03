import { describe, expect, it } from "vitest";
import { esquemaMes, esquemaMetasProduto } from "./meta";

const agora = new Date("2026-11-15T12:00:00Z");

describe("esquemaMes", () => {
  it("mês inválido cai no mês atual", () => {
    expect(esquemaMes(agora).parse("2026-13")).toBe("2026-11");
    expect(esquemaMes(agora).parse("abc")).toBe("2026-11");
    expect(esquemaMes(agora).parse(undefined)).toBe("2026-11");
  });

  it("mês válido é mantido", () => {
    expect(esquemaMes(agora).parse("2026-10")).toBe("2026-10");
  });
});

describe("esquemaMetasProduto", () => {
  const base = { mes: "2026-11", produtoId: "p1" };

  it("lê valor em reais e quantidade vazia como zero", () => {
    const d = esquemaMetasProduto.parse({ ...base, linhas: [{ vendedorId: "ana", valorAlvo: "R$ 360.000,00", quantidadeAlvo: "" }] });
    expect(d.linhas[0]).toEqual({ vendedorId: "ana", valorAlvo: "360000.00", quantidadeAlvo: 0 });
  });

  it("valor vazio vira zero", () => {
    expect(
      esquemaMetasProduto.parse({ ...base, linhas: [{ vendedorId: "ana", valorAlvo: "", quantidadeAlvo: "3" }] }).linhas[0]?.valorAlvo,
    ).toBe("0.00");
  });

  it("recusa quantidade negativa ou quebrada e valor inválido", () => {
    for (const linha of [
      { vendedorId: "ana", valorAlvo: "100", quantidadeAlvo: "-1" },
      { vendedorId: "ana", valorAlvo: "100", quantidadeAlvo: "1,5" },
      { vendedorId: "ana", valorAlvo: "abc", quantidadeAlvo: "1" },
    ]) {
      expect(esquemaMetasProduto.safeParse({ ...base, linhas: [linha] }).success).toBe(false);
    }
  });

  it("recusa mês inválido", () => {
    expect(esquemaMetasProduto.safeParse({ mes: "2026-13", produtoId: "p1", linhas: [] }).success).toBe(false);
  });
});
