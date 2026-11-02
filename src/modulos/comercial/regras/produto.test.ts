import { describe, expect, it } from "vitest";
import { ajustarPadrao, cargaTotal, podeExcluirProduto } from "./produto";

const semCarga = { cargaTeoricaPresencial: null, cargaTeoricaSincrona: null, cargaTeoricaAssincrona: null, cargaPratica: null, cargaExtra: null };

describe("cargaTotal", () => {
  it("soma as cargas preenchidas", () => {
    expect(cargaTotal({ ...semCarga, cargaTeoricaPresencial: 8, cargaPratica: 36 })).toBe(44);
  });

  it("sem nenhuma carga, não há total", () => {
    expect(cargaTotal(semCarga)).toBeNull();
  });
});

describe("podeExcluirProduto", () => {
  it("só sem vendas e sem metas", () => {
    expect(podeExcluirProduto({ vendas: 0, metas: 0 })).toBe(true);
    expect(podeExcluirProduto({ vendas: 1, metas: 0 })).toBe(false);
    expect(podeExcluirProduto({ vendas: 0, metas: 1 })).toBe(false);
  });
});

describe("ajustarPadrao", () => {
  it("deixa só a oferta escolhida como padrão", () => {
    const ofertas = [
      { id: "a", padrao: true },
      { id: "b", padrao: false },
      { id: "c", padrao: true },
    ];
    expect(ajustarPadrao(ofertas, "b").map((o) => o.padrao)).toEqual([false, true, false]);
  });
});
