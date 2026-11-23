import { describe, expect, it } from "vitest";
import { fracaoDoMes, itemDoResumo, resumoDoInicio } from "./resumo-mes";

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

describe("itemDoResumo sem realizado", () => {
  it("realizado nulo não tem barra nem status, mas guarda a meta", () => {
    expect(itemDoResumo(null, 300, "2026-11-15")).toEqual({ realizado: null, meta: 300, pct: null, esperadoPct: null, status: null });
  });
});

describe("resumoDoInicio", () => {
  const numeros = { vendido: "57000.00", quantidade: 2, metaValor: "120000.00", metaQuantidade: 4 };
  const plano = { alunos: 10, valorReais: 500000, leads: 800 };

  it("vendas e faturamento são exatamente os números do dashboard do Comercial", () => {
    const r = resumoDoInicio({ numeros, leads: 360, plano: null }, "2026-11-15");
    expect(r.vendas.realizado).toBe(numeros.quantidade);
    expect(r.faturamento.realizado).toBe(Number(numeros.vendido));
    expect(r.vendas.meta).toBe(numeros.metaQuantidade);
    expect(r.faturamento.meta).toBe(Number(numeros.metaValor));
    expect(r.metaDe).toEqual({ vendas: "comercial", faturamento: "comercial", leads: null });
  });
  it("a meta do Comercial vence a do Planejamento", () => {
    const r = resumoDoInicio({ numeros, leads: 360, plano }, "2026-11-15");
    expect(r.vendas.meta).toBe(4);
    expect(r.faturamento.meta).toBe(120000);
  });
  it("sem meta no Comercial, usa a do Planejamento", () => {
    const r = resumoDoInicio({ numeros: { ...numeros, metaValor: "0.00", metaQuantidade: 0 }, leads: 360, plano }, "2026-11-15");
    expect(r.vendas.meta).toBe(10);
    expect(r.faturamento.meta).toBe(500000);
    expect(r.metaDe.vendas).toBe("planejamento");
  });
  it("leads: os do Comercial, com a meta do Planejamento", () => {
    const r = resumoDoInicio({ numeros, leads: 360, plano }, "2026-11-15");
    expect(r.leads.realizado).toBe(360);
    expect(r.leads.meta).toBe(800);
    expect(r.metaDe.leads).toBe("planejamento");
  });
  it("sem meta em lugar nenhum, fica sem meta", () => {
    const r = resumoDoInicio({ numeros: { ...numeros, metaValor: "0.00", metaQuantidade: 0 }, leads: null, plano: null }, "2026-11-15");
    expect(r.vendas.meta).toBeNull();
    expect(r.faturamento.meta).toBeNull();
    expect(r.leads).toEqual({ realizado: null, meta: null, pct: null, esperadoPct: null, status: null });
  });
});
