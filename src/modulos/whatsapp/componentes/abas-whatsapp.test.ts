import { describe, expect, it } from "vitest";
import { abasDoPapel, secoesDoPapel } from "./abas-whatsapp";

describe("secoesDoPapel / abasDoPapel", () => {
  it("gestor vê as quatro seções na ordem", () => {
    expect(secoesDoPapel("gestor").map((s) => s.chave)).toEqual(["visao-geral", "grupos", "equipe", "configuracoes"]);
    expect(abasDoPapel("gestor").map((a) => a.chave)).toEqual([
      "visao-geral", "grupos", "atendimento", "leads", "cs", "conversas", "numeros", "configuracoes",
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
  it("comercial não vê atendimento, leads nem cs", () => {
    const comercial = abasDoPapel("comercial").map((a) => a.chave);
    expect(comercial).not.toContain("atendimento");
    expect(comercial).not.toContain("cs");
    expect(comercial).not.toContain("leads");
  });
});
