import { describe, expect, it } from "vitest";
import { cac, custoPorLead, filtrandoCampanhas, filtrosValidos, formatarRoas, roas, totalLeads } from "./midia";

describe("filtrandoCampanhas", () => {
  it("só quando algum filtro de campanha está ativo", () => {
    expect(filtrandoCampanhas({ campanhas: [], situacao: "todas" })).toBe(false);
    expect(filtrandoCampanhas({ conta: "c1", campanhas: [], situacao: "todas" })).toBe(true);
    expect(filtrandoCampanhas({ campanhas: ["x"], situacao: "todas" })).toBe(true);
    expect(filtrandoCampanhas({ busca: "capilar", campanhas: [], situacao: "todas" })).toBe(true);
    expect(filtrandoCampanhas({ campanhas: [], situacao: "ativas" })).toBe(true);
  });
});

describe("custo por lead, CAC e ROAS", () => {
  it("custo por lead", () => {
    expect(custoPorLead(10000, 4)).toBe("25.00");
    expect(custoPorLead(10000, 0)).toBeNull();
  });

  it("CAC só com vendas e a partir de novembro de 2026", () => {
    expect(cac(100000, 4, "2026-11")).toBe("250.00");
    expect(cac(100000, 0, "2026-11")).toBeNull();
    expect(cac(100000, 4, "2026-10")).toBeNull();
  });

  it("ROAS com uma casa, só com investimento e a partir de novembro de 2026", () => {
    expect(roas(420000, 100000, "2026-11")).toBe(4.2);
    expect(roas(420000, 0, "2026-11")).toBeNull();
    expect(roas(420000, 100000, "2026-10")).toBeNull();
    expect(formatarRoas(4.2)).toBe("4,2x");
    expect(formatarRoas(null)).toBe("—");
  });

  it("total de leads soma os três tipos", () => {
    expect(totalLeads({ leadsFormulario: 2, leadsSite: 3, conversasIniciadas: 5 })).toBe(10);
  });
});

describe("filtrosValidos", () => {
  const validos = {
    contas: ["a1", "a2"],
    campanhas: [
      { id: "c1", contaId: "a1" },
      { id: "c2", contaId: "a2" },
    ],
  };

  it("ignora conta e campanhas que não existem (ou de conta desligada)", () => {
    expect(filtrosValidos({ conta: "x", campanhas: ["c1", "zz"], situacao: "todas" }, validos)).toEqual({
      conta: undefined,
      campanhas: ["c1"],
      situacao: "todas",
    });
  });

  it("com conta escolhida, só ficam as campanhas dela", () => {
    expect(filtrosValidos({ conta: "a2", campanhas: ["c1", "c2"], situacao: "todas" }, validos).campanhas).toEqual(["c2"]);
  });
});
