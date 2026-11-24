import { describe, expect, it } from "vitest";
import { abasDoPapel, secoesDoPapel } from "./abas-whatsapp";

describe("secoesDoPapel / abasDoPapel", () => {
  it("gestor vê as quatro seções na ordem", () => {
    expect(secoesDoPapel("gestor").map((s) => s.chave)).toEqual(["visao-geral", "grupos", "equipe", "configuracoes"]);
    expect(abasDoPapel("gestor").map((a) => a.chave)).toEqual([
      "visao-geral", "grupos", "avisos", "atendimento", "leads", "cs", "conversas", "numeros", "configuracoes",
    ]);
  });
  it("vendedor vê só Equipe (Conversas) e Configurações (Números)", () => {
    const secoes = secoesDoPapel("comercial");
    expect(secoes.map((s) => s.chave)).toEqual(["equipe", "configuracoes"]);
    expect(secoes[0].abas.map((a) => a.chave)).toEqual(["conversas"]);
    expect(secoes[1].abas.map((a) => a.chave)).toEqual(["numeros"]);
    expect(secoes[0].href).toBe("/whatsapp/conversas");
    expect(abasDoPapel("comercial")[0].href).toBe("/whatsapp/conversas");
  });
  it("avisos fica na seção Grupos, depois de Grupos, só para quem tem whatsapp:avisos", () => {
    const grupos = secoesDoPapel("gestor").find((s) => s.chave === "grupos");
    expect(grupos?.abas.map((a) => [a.chave, a.href, a.rotulo])).toEqual([
      ["grupos", "/whatsapp/grupos", "Grupos"],
      ["avisos", "/whatsapp/avisos", "Avisos"],
    ]);
    expect(abasDoPapel("comercial").map((a) => a.chave)).not.toContain("avisos");
  });
  it("comercial não vê atendimento, leads nem cs", () => {
    const comercial = abasDoPapel("comercial").map((a) => a.chave);
    expect(comercial).not.toContain("atendimento");
    expect(comercial).not.toContain("cs");
    expect(comercial).not.toContain("leads");
  });
});
