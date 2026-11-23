import { describe, expect, it } from "vitest";
import { esquemaLancamento, esquemaMesPlano, esquemaPremissasFunil, esquemaTurma } from "./planejamento";

const funil = { convLeadAgendada: "20", comparecimento: "75", convReuniaoVenda: "25", custoPorLead: "150,00", comissaoPct: "5", tetoCacPct: "10" };

describe("esquemaPremissasFunil", () => {
  it("lê percentuais como fração e o custo em centavos", () => {
    expect(esquemaPremissasFunil.parse(funil)).toEqual({
      convLeadAgendada: 0.2,
      comparecimento: 0.75,
      convReuniaoVenda: 0.25,
      custoPorLeadCentavos: 15_000,
      comissaoPct: 0.05,
      tetoCacPct: 0.1,
    });
  });
  it("aceita vírgula decimal", () => expect(esquemaPremissasFunil.parse({ ...funil, comissaoPct: "2,5" }).comissaoPct).toBeCloseTo(0.025));
  it("recusa percentual acima de 100", () => {
    const r = esquemaPremissasFunil.safeParse({ ...funil, comparecimento: "120" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("Use um valor entre 0 e 100.");
  });
});

describe("esquemaTurma", () => {
  it("campos vazios viram null (usam a premissa)", () => {
    const r = esquemaTurma.parse({ produtoId: "p", codigo: "T5", mesAbertura: "2027-01", alunos: "", contratoMedio: "", janelaVendasMeses: "", duracaoMeses: "" });
    expect(r).toMatchObject({ alunos: null, contratoCentavos: null, janelaVendasMeses: null, duracaoMeses: null });
  });
  it("lê o contrato em reais", () => {
    const r = esquemaTurma.parse({ produtoId: "p", codigo: "T5", mesAbertura: "2027-01", contratoMedio: "75.000,00" });
    expect(r.contratoCentavos).toBe(7_500_000);
  });
});

describe("esquemaMesPlano", () => {
  it("recusa mês inválido", () => expect(esquemaMesPlano.safeParse("2027-13").success).toBe(false));
  it("aceita AAAA-MM", () => expect(esquemaMesPlano.parse("2027-01")).toBe("2027-01"));
});

describe("esquemaLancamento", () => {
  it("valor vazio apaga (null)", () => expect(esquemaLancamento.parse({ indicadorId: "i", mes: "2027-01", valor: "" }).valor).toBeNull());
  it("lê número com milhar", () => expect(esquemaLancamento.parse({ indicadorId: "i", mes: "2027-01", valor: "1.250" }).valor).toBe(1250));
});
