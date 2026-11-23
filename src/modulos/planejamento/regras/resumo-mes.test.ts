import { describe, expect, it } from "vitest";
import { fracaoDoMes, itemDoResumo } from "./resumo-mes";

describe("fracaoDoMes", () => {
  it("conta o dia de hoje como passado", () => expect(fracaoDoMes("2026-11-15")).toBe(0.5));
  it("último dia = mês inteiro", () => expect(fracaoDoMes("2026-02-28")).toBe(1));
  it("fevereiro bissexto tem 29 dias", () => expect(fracaoDoMes("2028-02-29")).toBe(1));
});

describe("itemDoResumo", () => {
  it("sem meta: só o realizado, sem barra nem status", () => {
    expect(itemDoResumo(7, null, "2026-11-15")).toEqual({ realizado: 7, meta: null, pct: null, esperadoPct: null, status: null });
  });
  it("meta zero conta como sem meta", () => {
    expect(itemDoResumo(7, 0, "2026-11-15").meta).toBeNull();
  });
  it("cor pelo ritmo: metade do mês com metade da meta é ✔", () => {
    const r = itemDoResumo(10, 20, "2026-11-15");
    expect(r.pct).toBe(0.5);
    expect(r.esperadoPct).toBe(0.5);
    expect(r.status).toBe("ok");
  });
  it("abaixo de 80% do esperado é ✖", () => {
    expect(itemDoResumo(7, 20, "2026-11-15").status).toBe("ruim"); // 7 de 10 esperados
  });
  it("entre 80% e 99% do esperado é ⚠", () => {
    expect(itemDoResumo(9, 20, "2026-11-15").status).toBe("atencao");
  });
  it("no último dia, compara com a meta cheia", () => {
    expect(itemDoResumo(19, 20, "2026-11-30").status).toBe("atencao");
  });
  it("passar da meta não estoura o esperado", () => {
    const r = itemDoResumo(30, 20, "2026-11-15");
    expect(r.pct).toBe(1.5);
    expect(r.status).toBe("ok");
  });
});
