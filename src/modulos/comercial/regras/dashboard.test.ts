import { describe, expect, it } from "vitest";
import { faixaMeta, mesesDaJanela, percentualMeta, resumoSerie, ticketMedio, tomVariacao, variacao } from "./dashboard";

describe("variacao", () => {
  it("compara com o mês anterior em % inteiro", () => {
    expect(variacao("110.00", "100.00")).toBe(10);
    expect(variacao("90.00", "100.00")).toBe(-10);
  });

  it("sem venda no mês anterior, não há variação", () => {
    expect(variacao("50.00", "0.00")).toBeNull();
  });
});

describe("ticketMedio", () => {
  it("vendido ÷ quantidade, em centavos", () => {
    expect(ticketMedio("300.00", 3)).toBe("100.00");
    expect(ticketMedio("100.00", 3)).toBe("33.33");
  });

  it("sem vendas, não há ticket", () => {
    expect(ticketMedio("0.00", 0)).toBeNull();
  });
});

describe("percentualMeta e faixaMeta", () => {
  it("sem meta, não há percentual", () => {
    expect(percentualMeta(0, 0)).toBeNull();
    expect(faixaMeta(null)).toBeNull();
  });

  it("% inteiro do realizado sobre o alvo", () => {
    expect(percentualMeta(7000, 10000)).toBe(70);
  });

  it("verde a partir de 100, amarelo de 70 a 99, vermelho abaixo de 70", () => {
    expect(faixaMeta(100)).toBe("verde");
    expect(faixaMeta(99)).toBe("amarelo");
    expect(faixaMeta(70)).toBe("amarelo");
    expect(faixaMeta(69)).toBe("vermelho");
  });
});

describe("mesesDaJanela", () => {
  it("do mais antigo ao último, atravessando o ano", () => {
    expect(mesesDaJanela("2027-02", 4)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
});

describe("resumoSerie", () => {
  it("soma o vendido e conta os meses que bateram a meta", () => {
    expect(
      resumoSerie([
        { mes: "2026-09", vendido: "100.00", meta: "100.00" },
        { mes: "2026-10", vendido: "50.00", meta: "100.00" },
        { mes: "2026-11", vendido: "30.00", meta: "0.00" },
      ]),
    ).toEqual({ total: "180.00", comMeta: 2, bateram: 1 });
  });
});

describe("tomVariacao", () => {
  it("verde só quando subiu, vermelho quando caiu, neutro quando ficou igual", () => {
    expect(tomVariacao(12)).toBe("subiu");
    expect(tomVariacao(-5)).toBe("caiu");
    expect(tomVariacao(0)).toBe("igual");
    expect(tomVariacao(null)).toBeNull();
  });
});
