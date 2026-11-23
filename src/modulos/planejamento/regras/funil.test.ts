import { describe, expect, it } from "vitest";
import { calcularFunil, conversaoGeral, type PremissasFunil } from "./funil";

const p: PremissasFunil = {
  convLeadAgendada: 0.2,
  comparecimento: 0.75,
  convReuniaoVenda: 0.25,
  custoPorLeadCentavos: 15_000,
  comissaoPct: 0.05,
  tetoCacPct: 0.1,
};

describe("calcularFunil", () => {
  it("calcula de trás para frente como a planilha (jan/27)", () => {
    const f = calcularFunil({ alunos: 7, valorCentavos: 29_500_000 }, p);
    expect(f.reunioesRealizadas).toBe(28);
    expect(f.reunioesAgendadas).toBe(38);
    expect(f.leads).toBe(190);
    expect(f.verbaCentavos).toBe(2_850_000);
    expect(f.comissaoCentavos).toBe(1_475_000);
    expect(f.cacTotalCentavos).toBe(4_325_000);
    expect(f.cacPorAlunoCentavos).toBe(617_857);
    expect(f.cacPct).toBeCloseTo(0.1466, 4);
    expect(f.acimaDoTeto).toBe(true);
  });

  it("sem alunos, zera e não divide por zero", () => {
    const f = calcularFunil({ alunos: 0, valorCentavos: 0 }, p);
    expect(f.leads).toBe(0);
    expect(f.verbaCentavos).toBe(0);
    expect(f.cacPorAlunoCentavos).toBeNull();
    expect(f.cacPct).toBeNull();
    expect(f.acimaDoTeto).toBe(false);
  });

  it("conversão zerada deixa as contagens vazias", () => {
    const f = calcularFunil({ alunos: 7, valorCentavos: 29_500_000 }, { ...p, convReuniaoVenda: 0 });
    expect(f.reunioesRealizadas).toBeNull();
    expect(f.reunioesAgendadas).toBeNull();
    expect(f.leads).toBeNull();
    expect(f.verbaCentavos).toBeNull();
    expect(f.cacTotalCentavos).toBeNull();
  });
});

describe("conversaoGeral", () => {
  it("é o produto das três conversões", () => {
    expect(conversaoGeral(p)).toBeCloseTo(0.0375, 6);
  });
});
