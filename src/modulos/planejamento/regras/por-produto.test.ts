import { describe, expect, it } from "vitest";
import { metaVsRealizadoPorProduto } from "./por-produto";

describe("metaVsRealizadoPorProduto", () => {
  const metas = { a: { alunos: 4, valorCentavos: 400_000 }, b: { alunos: 2, valorCentavos: 100_000 } };
  const reais = { a: { alunos: 4, valorCentavos: 420_000 }, c: { alunos: 1, valorCentavos: 50_000 } };

  it("cruza meta e realizado de cada produto, com status pelo valor", () => {
    const r = metaVsRealizadoPorProduto(metas, reais);
    const a = r.find((l) => l.produtoId === "a")!;
    expect(a).toMatchObject({ meta: { alunos: 4, valorCentavos: 400_000 }, realizado: { alunos: 4, valorCentavos: 420_000 }, status: "ok" });
    expect(a.pct).toBeCloseTo(1.05);
  });
  it("produto com meta e sem venda fica com zero e ✖", () => {
    const b = metaVsRealizadoPorProduto(metas, reais).find((l) => l.produtoId === "b")!;
    expect(b.realizado).toEqual({ alunos: 0, valorCentavos: 0 });
    expect(b.status).toBe("ruim");
  });
  it("produto vendido sem meta aparece, sem status", () => {
    const c = metaVsRealizadoPorProduto(metas, reais).find((l) => l.produtoId === "c")!;
    expect(c.meta).toEqual({ alunos: 0, valorCentavos: 0 });
    expect(c.pct).toBeNull();
    expect(c.status).toBeNull();
  });
  it("ordena pela meta em valor, maior primeiro; sem meta no fim", () => {
    expect(metaVsRealizadoPorProduto(metas, reais).map((l) => l.produtoId)).toEqual(["a", "b", "c"]);
  });
});
