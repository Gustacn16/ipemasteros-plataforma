import { describe, expect, it } from "vitest";
import { opcoesDoFormulario } from "./opcoes-venda";

const produtos = [{ id: "p1", nome: "Pós Capilar", tipo: "pos_graduacao" as const, ofertas: [] }];
const vendedores = [{ id: "u1", nome: "Ana" }];
const canais = [{ id: "c1", nome: "Instagram" }];
const vendaAntiga = {
  produtoId: "p-inativo",
  produtoNome: "Produto antigo",
  ofertaId: "o-antiga",
  ofertaNome: "À vista",
  vendedorId: "u-saiu",
  vendedorNome: "Bruno",
  canalId: "c-inativo",
  canalNome: "Feira",
};

describe("opcoesDoFormulario", () => {
  it("venda nova usa só as opções ativas", () => {
    const o = opcoesDoFormulario({ produtos, vendedores, canais, venda: null });
    expect(o.produtos.map((p) => p.id)).toEqual(["p1"]);
    expect(o.vendedores.map((v) => v.id)).toEqual(["u1"]);
  });

  it("venda antiga mantém produto inativo com a oferta escolhida, vendedor que saiu e canal inativo", () => {
    const o = opcoesDoFormulario({ produtos, vendedores, canais, venda: vendaAntiga });
    const produto = o.produtos.find((p) => p.id === "p-inativo");
    expect(produto?.ofertas.map((of) => of.id)).toEqual(["o-antiga"]);
    expect(o.vendedores.map((v) => v.id)).toContain("u-saiu");
    expect(o.canais.map((c) => c.id)).toContain("c-inativo");
  });
});
