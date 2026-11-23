import { describe, expect, it } from "vitest";
import { distribuirTurma, metasDeVendas, type Premissa, type Turma } from "./turmas";

const premissa: Premissa = { produtoId: "p", contratoCentavos: 7_500_000, alunosPorTurma: 10, janelaVendasMeses: 6, duracaoMeses: 12 };
const turma = (t: Partial<Turma>): Turma => ({
  id: "t",
  produtoId: "p",
  codigo: "T1",
  mesAbertura: "2027-05",
  alunos: null,
  contratoCentavos: null,
  janelaVendasMeses: null,
  duracaoMeses: null,
  ...t,
});

describe("distribuirTurma", () => {
  it("divide os alunos pela janela que termina na abertura, com a sobra nos últimos meses", () => {
    const r = distribuirTurma(turma({ alunos: 15, janelaVendasMeses: 4 }), premissa);
    expect(r.map((m) => [m.mes, m.alunos])).toEqual([
      ["2027-02", 3],
      ["2027-03", 4],
      ["2027-04", 4],
      ["2027-05", 4],
    ]);
    expect(r[1].valorCentavos).toBe(4 * 7_500_000);
  });

  it("campos vazios herdam a premissa do produto", () => {
    const r = distribuirTurma(turma({}), premissa);
    expect(r).toHaveLength(6);
    expect(r.reduce((s, m) => s + m.alunos, 0)).toBe(10);
    expect(r[0].mes).toBe("2026-12");
  });

  it("sem premissa e sem números, não gera meta", () => {
    expect(distribuirTurma(turma({}), undefined).reduce((s, m) => s + m.alunos, 0)).toBe(0);
  });
});

describe("metasDeVendas", () => {
  it("janela que começa no ano anterior vai para 'antes do período'", () => {
    const r = metasDeVendas(2027, [premissa], [turma({ mesAbertura: "2027-01", alunos: 15, janelaVendasMeses: 5 })], []);
    expect(r.porMes["2027-01"].p.alunos).toBe(3);
    expect(r.antes.p.alunos).toBe(12);
    expect(r.depois.p).toBeUndefined();
  });

  it("janela que passa do ano vai para 'depois do período'", () => {
    const r = metasDeVendas(2027, [premissa], [turma({ mesAbertura: "2028-01", alunos: 15, janelaVendasMeses: 4 })], []);
    expect(r.porMes["2027-10"].p.alunos).toBe(3);
    expect(r.porMes["2027-11"].p.alunos).toBe(4);
    expect(r.porMes["2027-12"].p.alunos).toBe(4);
    expect(r.depois.p.alunos).toBe(4);
  });

  it("meta avulsa soma com a da turma no mesmo produto e mês", () => {
    const r = metasDeVendas(2027, [premissa], [turma({ alunos: 4, janelaVendasMeses: 1 })], [
      { produtoId: "p", mes: "2027-05", alunos: 2, valorCentavos: 800_000 },
    ]);
    expect(r.porMes["2027-05"].p).toEqual({ alunos: 6, valorCentavos: 4 * 7_500_000 + 800_000 });
  });

  it("tem os 12 meses mesmo sem nada cadastrado", () => {
    const r = metasDeVendas(2027, [], [], []);
    expect(Object.keys(r.porMes)).toHaveLength(12);
    expect(r.porMes["2027-01"]).toEqual({});
  });
});
