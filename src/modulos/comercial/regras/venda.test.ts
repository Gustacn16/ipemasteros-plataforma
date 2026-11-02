import { describe, expect, it } from "vitest";
import { podeEditarVenda, preencherPelaOferta, valorTotal, vendedorPermitido } from "./venda";

describe("valorTotal", () => {
  it("soma entrada e parcelas", () => {
    expect(valorTotal("2000.00", 12, "5800.00")).toBe("71600.00");
  });

  it("não perde centavos", () => {
    expect(valorTotal("0.01", 3, "333.33")).toBe("1000.00");
  });

  it("à vista é só a entrada", () => {
    expect(valorTotal("2500.00", 0, "0.00")).toBe("2500.00");
  });
});

describe("preencherPelaOferta", () => {
  it("usa matrícula e parcela da oferta", () => {
    expect(preencherPelaOferta({ precoCheio: "72000.00", matricula: "2000.00", parcelas: 12, valorParcela: "5800.00" })).toEqual({
      entrada: "2000.00",
      numeroParcelas: 12,
      valorParcela: "5800.00",
    });
  });

  it("sem valor de parcela, divide o restante pelas parcelas", () => {
    expect(preencherPelaOferta({ precoCheio: "70000.00", matricula: "3000.00", parcelas: 12, valorParcela: "0.00" }).valorParcela).toBe(
      "5583.33",
    );
  });

  it("à vista, a entrada é o preço inteiro", () => {
    expect(preencherPelaOferta({ precoCheio: "2500.00", matricula: "300.00", parcelas: 0, valorParcela: "0.00" })).toEqual({
      entrada: "2500.00",
      numeroParcelas: 0,
      valorParcela: "0.00",
    });
  });
});

describe("podeEditarVenda", () => {
  const agora = new Date("2026-11-20T12:00:00Z");
  const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);
  const vendaDe = (vendedorId: string, dias: number) => ({ vendedorId, criadoEm: diasAtras(dias) });

  it("admin e gestor editam qualquer venda, a qualquer tempo", () => {
    expect(podeEditarVenda({ id: "g", papel: "gestor" }, vendaDe("outro", 30), agora)).toBe(true);
    expect(podeEditarVenda({ id: "a", papel: "admin" }, vendaDe("outro", 30), agora)).toBe(true);
  });

  it("vendedor edita a própria venda por até 7 dias", () => {
    expect(podeEditarVenda({ id: "v", papel: "comercial" }, vendaDe("v", 6), agora)).toBe(true);
    expect(podeEditarVenda({ id: "v", papel: "comercial" }, vendaDe("v", 8), agora)).toBe(false);
  });

  it("vendedor não edita venda de outra pessoa; colaborador não edita", () => {
    expect(podeEditarVenda({ id: "v", papel: "comercial" }, vendaDe("outro", 1), agora)).toBe(false);
    expect(podeEditarVenda({ id: "c", papel: "colaborador" }, vendaDe("c", 1), agora)).toBe(false);
  });
});

describe("vendedorPermitido", () => {
  it("gestor escolhe qualquer vendedor; vendedor só a si mesmo", () => {
    expect(vendedorPermitido({ id: "g", papel: "gestor" }, "outro")).toBe(true);
    expect(vendedorPermitido({ id: "v", papel: "comercial" }, "v")).toBe(true);
    expect(vendedorPermitido({ id: "v", papel: "comercial" }, "outro")).toBe(false);
  });
});
