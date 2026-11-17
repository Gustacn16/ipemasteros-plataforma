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

  it("só a quantidade vem da tela; vazia vale zero", () => {
    const d = esquemaMetasProduto.parse({ ...base, linhas: [{ vendedorId: "ana", quantidadeAlvo: "" }] });
    expect(d.linhas[0]).toEqual({ vendedorId: "ana", quantidadeAlvo: 0 });
  });

  it("valor mandado pela tela é ignorado (o servidor calcula pelo preço do produto)", () => {
    const d = esquemaMetasProduto.parse({ ...base, linhas: [{ vendedorId: "ana", valorAlvo: "999", quantidadeAlvo: "3" }] });
    expect(d.linhas[0]).toEqual({ vendedorId: "ana", quantidadeAlvo: 3 });
  });

  it("recusa quantidade negativa ou quebrada", () => {
    for (const linha of [
      { vendedorId: "ana", quantidadeAlvo: "-1" },
      { vendedorId: "ana", quantidadeAlvo: "1,5" },
    ]) {
      expect(esquemaMetasProduto.safeParse({ ...base, linhas: [linha] }).success).toBe(false);
    }
  });

  it("recusa mês inválido", () => {
    expect(esquemaMetasProduto.safeParse({ mes: "2026-13", produtoId: "p1", linhas: [] }).success).toBe(false);
  });
});
