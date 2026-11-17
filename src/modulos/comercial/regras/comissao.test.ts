import { describe, expect, it } from "vitest";
import { calcularComissoes, comissaoDaVenda } from "./comissao";

const produtos = new Map([
  ["hib", { nome: "Psiquiatria Híbrido", tipo: "percentual" as const, base: "1.25", bonus: "2.50" }],
  ["fue", { nome: "Master FUE", tipo: "valor" as const, base: "450.00", bonus: "600.00" }],
  ["sem", { nome: "Sem bônus", tipo: "valor" as const, base: "100.00", bonus: "0.00" }],
]);
const venda = (vendedorId: string, produtoId: string, valorTotal: string) => ({ vendedorId, produtoId, valorTotal });

describe("comissaoDaVenda", () => {
  it("R$ fixo é o próprio valor; % é sobre o valor total do contrato, em centavos", () => {
    expect(comissaoDaVenda("valor", "450.00", "28500.00")).toBe("450.00");
    expect(comissaoDaVenda("percentual", "1.25", "28500.00")).toBe("356.25");
    expect(comissaoDaVenda("percentual", "2", "11880.00")).toBe("237.60");
    expect(comissaoDaVenda("percentual", "0", "1000.00")).toBe("0.00");
  });
});

describe("calcularComissoes", () => {
  it("sem bater a meta do produto, vale a base (caso do Arthur: 2 vendas de 28.500 a 1,25%)", () => {
    const r = calcularComissoes({
      vendedores: [{ id: "arthur", nome: "Arthur" }],
      vendas: [venda("arthur", "hib", "28500.00"), venda("arthur", "hib", "28500.00")],
      metas: [{ vendedorId: "arthur", produtoId: "hib", quantidadeAlvo: 3 }],
      produtos,
    });
    expect(r.totalVendido).toBe("57000.00");
    expect(r.totalComissao).toBe("712.50");
    const p = r.vendedores[0]!.produtos[0]!;
    expect(p).toMatchObject({ vendas: 2, meta: 3, bateuMeta: false, taxa: "1.25", vendido: "57000.00", comissao: "712.50" });
  });

  it("batendo a meta do produto, todas as vendas desse produto no mês valem o bônus", () => {
    const r = calcularComissoes({
      vendedores: [{ id: "ana", nome: "Ana" }],
      vendas: [venda("ana", "fue", "6000.00"), venda("ana", "fue", "6000.00"), venda("ana", "hib", "28500.00")],
      metas: [
        { vendedorId: "ana", produtoId: "fue", quantidadeAlvo: 2 },
        { vendedorId: "ana", produtoId: "hib", quantidadeAlvo: 2 },
      ],
      produtos,
    });
    const ana = r.vendedores[0]!;
    expect(ana.produtos.find((p) => p.produtoId === "fue")).toMatchObject({ bateuMeta: true, taxa: "600.00", comissao: "1200.00" });
    expect(ana.produtos.find((p) => p.produtoId === "hib")).toMatchObject({ bateuMeta: false, comissao: "356.25" });
    expect(ana.comissao).toBe("1556.25");
    expect(ana.vendas).toBe(3);
  });

  it("sem meta no produto não há bônus; bônus zerado cai na base", () => {
    const r = calcularComissoes({
      vendedores: [{ id: "ana", nome: "Ana" }],
      vendas: [venda("ana", "fue", "6000.00"), venda("ana", "sem", "1000.00")],
      metas: [{ vendedorId: "ana", produtoId: "sem", quantidadeAlvo: 1 }],
      produtos,
    });
    const ps = r.vendedores[0]!.produtos;
    expect(ps.find((p) => p.produtoId === "fue")).toMatchObject({ meta: 0, bateuMeta: false, taxa: "450.00" });
    expect(ps.find((p) => p.produtoId === "sem")).toMatchObject({ bateuMeta: true, taxa: "100.00", comissao: "100.00" });
  });

  it("vendedor sem venda aparece zerado; vendedores em ordem de comissão", () => {
    const r = calcularComissoes({
      vendedores: [
        { id: "bia", nome: "Bia" },
        { id: "ana", nome: "Ana" },
      ],
      vendas: [venda("ana", "fue", "6000.00")],
      metas: [],
      produtos,
    });
    expect(r.vendedores.map((v) => [v.id, v.comissao, v.totalVendido])).toEqual([
      ["ana", "450.00", "6000.00"],
      ["bia", "0.00", "0.00"],
    ]);
  });

  it("produto sem regra de comissão conta no vendido e vale zero", () => {
    const r = calcularComissoes({ vendedores: [{ id: "ana", nome: "Ana" }], vendas: [venda("ana", "x", "500.00")], metas: [], produtos });
    expect(r.vendedores[0]).toMatchObject({ totalVendido: "500.00", comissao: "0.00" });
  });
});
