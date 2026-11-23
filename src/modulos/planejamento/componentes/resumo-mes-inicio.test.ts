import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { itemDoResumo } from "../regras/resumo-mes";
import { ResumoMesInicio } from "./resumo-mes-inicio";

const html = (resumo: Parameters<typeof ResumoMesInicio>[0]["resumo"]) =>
  renderToStaticMarkup(createElement(ResumoMesInicio, { mes: "2026-11", resumo }));

describe("ResumoMesInicio", () => {
  it("se o resumo falhou, o bloco aparece com — e um aviso", () => {
    const h = html(null);
    expect(h).toContain("Resumo de novembro de 2026");
    expect(h).toContain("Não deu para carregar");
    expect(h.match(/>—</g)?.length).toBe(3);
    expect(h).not.toContain("progressbar");
  });
  it("com meta, mostra a barra; sem meta, Meta: —", () => {
    const h = html({
      mes: "2026-11",
      ano: 2026,
      temPlano: true,
      vendas: itemDoResumo(10, 20, "2026-11-15"),
      faturamento: itemDoResumo(5000, null, "2026-11-15"),
      leads: itemDoResumo(100, 200, "2026-11-15"),
    });
    expect(h.match(/role="progressbar"/g)?.length).toBe(2);
    expect(h).toContain("Meta: —");
    expect(h).not.toContain("Não deu para carregar");
  });
});
