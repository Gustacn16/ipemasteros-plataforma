import { describe, expect, it } from "vitest";
import {
  cac,
  campanhasDaLista,
  categoriaDaCampanha,
  cpc,
  ctr,
  custoPorLead,
  filtrandoCampanhas,
  filtrosValidos,
  rankingCriativos,
  formatarRoas,
  roas,
  totalLeads,
} from "./midia";

describe("filtrandoCampanhas", () => {
  it("só quando algum filtro de campanha está ativo", () => {
    expect(filtrandoCampanhas({ campanhas: [], situacao: "todas" })).toBe(false);
    expect(filtrandoCampanhas({ conta: "c1", campanhas: [], situacao: "todas" })).toBe(true);
    expect(filtrandoCampanhas({ campanhas: ["x"], situacao: "todas" })).toBe(true);
    expect(filtrandoCampanhas({ busca: "capilar", campanhas: [], situacao: "todas" })).toBe(true);
    expect(filtrandoCampanhas({ campanhas: [], situacao: "ativas" })).toBe(true);
    expect(filtrandoCampanhas({ campanhas: [], situacao: "todas", categoria: "psiquiatria" })).toBe(true);
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

describe("campanhasDaLista", () => {
  const campanhas = [
    { id: "1", nome: "Zeta", status: "PAUSED" },
    { id: "2", nome: "Beta", status: "ACTIVE" },
    { id: "3", nome: "Alfa", status: "PAUSED" },
    { id: "4", nome: "Gama", status: "ACTIVE" },
  ];

  it("ativas primeiro, depois as pausadas, cada grupo em ordem de nome", () => {
    expect(campanhasDaLista(campanhas, "todas").map((c) => c.nome)).toEqual(["Beta", "Gama", "Alfa", "Zeta"]);
  });

  it("respeita a situação escolhida", () => {
    expect(campanhasDaLista(campanhas, "ativas").map((c) => c.nome)).toEqual(["Beta", "Gama"]);
    expect(campanhasDaLista(campanhas, "pausadas").map((c) => c.nome)).toEqual(["Alfa", "Zeta"]);
  });
});

describe("categoriaDaCampanha", () => {
  it.each([
    ["[ABO][CADASTRO][FORMS][FRIO]-Pós Graduação TCT", "transplante"],
    ["[ABO][TRÁFEGO] - Instagram TCT", "transplante"],
    ["Pós Transplante Capilar - Leads", "transplante"],
    ["[ABO][CADASTRO][FORMS][FRIO] - Pós Graduação Psiquiatria 2", "psiquiatria"],
    ["[ABO][TRÁFEGO] - Instagram PSIQ", "psiquiatria"],
    ["[ABO][ENGAJAMENTO][FRIO] - Paciente Modelo Transplante e Tratamento", "paciente_modelo"],
    ["PACIENTE MODELO capilar", "paciente_modelo"],
    ["Nova campanha de Engajamento", "outras"],
    ["Campanha 120249297561930528", "outras"],
  ])("%s → %s", (nome, categoria) => {
    expect(categoriaDaCampanha(nome)).toBe(categoria);
  });
});

describe("CTR e CPC do link", () => {
  it("CTR em % com duas casas; sem impressões, null", () => {
    expect(ctr(25, 1000)).toBe(2.5);
    expect(ctr(1, 3)).toBe(33.33);
    expect(ctr(5, 0)).toBeNull();
  });

  it("CPC = investimento ÷ cliques no link; sem cliques, null", () => {
    expect(cpc(10000, 40)).toBe("2.50");
    expect(cpc(10000, 0)).toBeNull();
  });
});

describe("rankingCriativos", () => {
  const base = { campanha: "C", miniatura: null, impressoes: 1000, cliquesLink: 10 };
  const itens = [
    { ...base, id: "a", nome: "A", investimento: 10000, leads: 10 }, // R$ 10 por lead
    { ...base, id: "b", nome: "B", investimento: 6000, leads: 10 }, // R$ 6
    { ...base, id: "c", nome: "C", investimento: 12000, leads: 20 }, // R$ 6, mais leads
    { ...base, id: "d", nome: "D", investimento: 4900, leads: 5 }, // abaixo de R$ 50
    { ...base, id: "e", nome: "E", investimento: 8000, leads: 0 }, // gastou sem lead
  ];

  it("ordena pelo menor custo por lead; empate fica com quem trouxe mais leads", () => {
    const r = rankingCriativos(itens);
    expect(r.ranking.map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(r.ranking[0]).toMatchObject({ posicao: 1, cpl: "6.00", investimento: "120.00", ctr: 1, cpc: "12.00" });
  });

  it("deixa de fora quem gastou menos de R$ 50 e conta quem gastou sem trazer lead", () => {
    const r = rankingCriativos(itens);
    expect(r.ranking.some((c) => c.id === "d")).toBe(false);
    expect(r.semLead).toBe(1);
  });

  it("mostra no máximo o limite pedido", () => {
    expect(rankingCriativos(itens, 2).ranking).toHaveLength(2);
  });
});
