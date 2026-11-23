import { describe, expect, it } from "vitest";
import { opcoesDoFormulario } from "./opcoes-venda";

const produtos = [{ id: "p1", nome: "Pós Capilar", tipo: "pos_graduacao" as const, ofertas: [], turmas: [{ id: "t1", nome: "5ª turma" }] }];
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
  turmaId: null,
  turmaNome: null,
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

  it("venda mantém a turma em que o aluno entrou, mesmo que ela não esteja mais aberta", () => {
    const venda = { ...vendaAntiga, produtoId: "p1", produtoNome: "Pós Capilar", turmaId: "t-velha", turmaNome: "4ª turma" };
    const o = opcoesDoFormulario({ produtos, vendedores, canais, venda });
    expect(o.produtos.find((p) => p.id === "p1")?.turmas.map((t) => t.id)).toEqual(["t1", "t-velha"]);
    const mesma = opcoesDoFormulario({ produtos, vendedores, canais, venda: { ...venda, turmaId: "t1", turmaNome: "5ª turma" } });
    expect(mesma.produtos[0].turmas).toHaveLength(1);
  });

  it("produto antigo da venda entra sem turmas além da dela", () => {
    const o = opcoesDoFormulario({ produtos, vendedores, canais, venda: { ...vendaAntiga, turmaId: "t9", turmaNome: "1ª turma" } });
    expect(o.produtos.find((p) => p.id === "p-inativo")?.turmas).toEqual([{ id: "t9", nome: "1ª turma" }]);
  });
});
