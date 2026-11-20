import { describe, expect, it } from "vitest";
import { abasDoPapel } from "./abas-whatsapp";

describe("abasDoPapel", () => {
  it("abasDoPapel(\"gestor\") inclui atendimento e cs; abasDoPapel(\"comercial\") não inclui", () => {
    expect(abasDoPapel("gestor").map((a) => a.chave)).toEqual(["grupos", "atendimento", "leads", "cs", "conversas", "numeros"]);
    const comercial = abasDoPapel("comercial").map((a) => a.chave);
    expect(comercial).not.toContain("atendimento");
    expect(comercial).not.toContain("cs");
    expect(comercial).not.toContain("leads");
  });
});
