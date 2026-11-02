import { describe, expect, it } from "vitest";
import { esquemaCanal, esquemaFiltrosProdutos, esquemaLink, esquemaOferta, esquemaProduto } from "./produto";

const produtoBase = { nome: "Master FUE", tipo: "curso_livre" };
const ofertaBase = { nome: "Padrão", precoCheio: "1000", parcelas: "10" };

describe("esquemaProduto", () => {
  it("normaliza o SKU para maiúsculas, sem espaços", () => {
    expect(esquemaProduto.parse({ ...produtoBase, sku: " pg001tct " }).sku).toBe("PG001TCT");
  });

  it("SKU e campos de texto vazios viram null", () => {
    const p = esquemaProduto.parse({
      ...produtoBase,
      sku: "",
      area: " ",
      duracaoMeses: "",
    });
    expect(p).toMatchObject({ sku: null, area: null, duracaoMeses: null });
  });

  it("recusa nome curto e tipo desconhecido", () => {
    expect(esquemaProduto.safeParse({ ...produtoBase, nome: "A" }).success).toBe(false);
    expect(esquemaProduto.safeParse({ ...produtoBase, tipo: "mentoria" }).success).toBe(false);
  });

  it("comissão em % não passa de 100", () => {
    const r = esquemaProduto.safeParse({
      ...produtoBase,
      comissaoTipo: "percentual",
      comissaoBase: "150",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Percentual deve ser até 100");
    expect(
      esquemaProduto.parse({
        ...produtoBase,
        comissaoTipo: "percentual",
        comissaoBase: "1,25",
      }).comissaoBase,
    ).toBe("1.25");
  });

  it("comissão em R$ aceita formato brasileiro e vazio vira 0", () => {
    const p = esquemaProduto.parse({
      ...produtoBase,
      comissaoBase: "R$ 1.000,00",
      comissaoBonus: "",
    });
    expect(p).toMatchObject({
      comissaoTipo: "valor",
      comissaoBase: "1000.00",
      comissaoBonus: "0.00",
    });
  });

  it("recusa carga horária negativa e lê caixa marcada", () => {
    expect(esquemaProduto.safeParse({ ...produtoBase, cargaPratica: "-1" }).success).toBe(false);
    expect(
      esquemaProduto.parse({
        ...produtoBase,
        cargaPratica: "36",
        recorrente: "on",
      }),
    ).toMatchObject({ cargaPratica: 36, recorrente: true });
  });
});

describe("esquemaOferta", () => {
  it("lê o preço no formato brasileiro e aceita à vista", () => {
    const o = esquemaOferta.parse({
      ...ofertaBase,
      precoCheio: "3.300,00",
      parcelas: "0",
    });
    expect(o).toMatchObject({
      precoCheio: "3300.00",
      parcelas: 0,
      matricula: "0.00",
      padrao: false,
      formasPagamento: [],
    });
  });

  it("recusa mais de 60 parcelas e desconto acima de 100%", () => {
    expect(esquemaOferta.safeParse({ ...ofertaBase, parcelas: "61" }).success).toBe(false);
    expect(esquemaOferta.safeParse({ ...ofertaBase, descontoPontualidadePct: "101" }).success).toBe(false);
  });

  it("aceita só formas de pagamento conhecidas", () => {
    expect(esquemaOferta.parse({ ...ofertaBase, formasPagamento: ["pix", "cartao"] }).formasPagamento).toEqual(["pix", "cartao"]);
    expect(esquemaOferta.safeParse({ ...ofertaBase, formasPagamento: ["dinheiro"] }).success).toBe(false);
  });

  it("link só com http ou https", () => {
    expect(esquemaOferta.safeParse({ ...ofertaBase, link: "javascript:alert(1)" }).success).toBe(false);
    expect(esquemaOferta.parse({ ...ofertaBase, link: "https://canva.link/x" }).link).toBe("https://canva.link/x");
    expect(esquemaOferta.parse({ ...ofertaBase, link: "" }).link).toBeNull();
  });
});

describe("esquemaLink e esquemaCanal", () => {
  it("link exige título e endereço http(s)", () => {
    expect(esquemaLink.safeParse({ titulo: "", url: "https://x.com" }).success).toBe(false);
    expect(esquemaLink.safeParse({ titulo: "Script", url: "ftp://x.com" }).success).toBe(false);
    expect(esquemaLink.parse({ titulo: "Script", url: "https://x.com" }).categoria).toBe("outro");
  });

  it("canal exige nome", () => {
    expect(esquemaCanal.safeParse({ nome: "" }).success).toBe(false);
    expect(esquemaCanal.parse({ nome: " Instagram " }).nome).toBe("Instagram");
  });
});

describe("esquemaFiltrosProdutos", () => {
  it("padrão: só ativos; valores inválidos são ignorados", () => {
    expect(esquemaFiltrosProdutos.parse({})).toEqual({ situacao: "ativos" });
    expect(esquemaFiltrosProdutos.parse({ tipo: "x", situacao: "y" })).toEqual({
      situacao: "ativos",
      tipo: undefined,
    });
  });
});
