import { describe, expect, it } from "vitest";
import { itensConfiguracao } from "./subabas-configuracoes";

describe("itensConfiguracao", () => {
  it("admin vê os três, na ordem Canais, Meta Ads e Aviso de venda", () => {
    expect(itensConfiguracao({ canais: true, meta: true, avisoVenda: true }).map((i) => i.rotulo)).toEqual([
      "Canais",
      "Meta Ads",
      "Aviso de venda",
    ]);
  });

  it("gestor só vê Canais; vendedor não vê nada", () => {
    expect(itensConfiguracao({ canais: true, meta: false, avisoVenda: false }).map((i) => i.href)).toEqual(["/comercial/canais"]);
    expect(itensConfiguracao({ canais: false, meta: false, avisoVenda: false })).toEqual([]);
  });
});
