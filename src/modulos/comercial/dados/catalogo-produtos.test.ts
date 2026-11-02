import { describe, expect, it } from "vitest";
import { esquemaLink, esquemaOferta, esquemaProduto } from "../esquemas/produto";
import { CATALOGO_PRODUTOS } from "./catalogo-produtos";

// Converte para o formato de formulário (strings) que os esquemas validam.
const comoFormulario = (o: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : typeof v === "boolean" ? (v ? "on" : "") : v === null ? "" : String(v)]),
  );

describe("catálogo de produtos importado", () => {
  it("tem os 12 produtos, com ids únicos", () => {
    expect(CATALOGO_PRODUTOS).toHaveLength(12);
    const ids = CATALOGO_PRODUTOS.flatMap((p) => [p.id, ...p.ofertas.map((o) => o.id), ...p.links.map((l) => l.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo produto, oferta e link passa na validação da tela", () => {
    for (const { ofertas, links, ...produto } of CATALOGO_PRODUTOS) {
      expect(esquemaProduto.safeParse(comoFormulario(produto)).success, produto.nome).toBe(true);
      for (const o of ofertas) expect(esquemaOferta.safeParse(comoFormulario(o)).success, `${produto.nome}: ${o.nome}`).toBe(true);
      for (const l of links) expect(esquemaLink.safeParse(comoFormulario(l)).success, `${produto.nome}: ${l.titulo}`).toBe(true);
    }
  });

  it("produto com ofertas tem exatamente uma padrão", () => {
    for (const p of CATALOGO_PRODUTOS.filter((p) => p.ofertas.length > 0)) {
      expect(
        p.ofertas.filter((o) => o.padrao),
        p.nome,
      ).toHaveLength(1);
    }
  });

  it("SKUs informados não se repetem", () => {
    const skus = CATALOGO_PRODUTOS.map((p) => p.sku).filter(Boolean);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("Psiquiatria EAD tem comissão em percentual", () => {
    const p = CATALOGO_PRODUTOS.find((p) => p.nome === "Pós-Graduação em Psiquiatria EAD");
    expect(p).toMatchObject({ comissaoTipo: "percentual", comissaoBase: "2.00", comissaoBonus: "4.00" });
  });
});
