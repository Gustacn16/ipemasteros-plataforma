import { describe, expect, it } from "vitest";
import { HREF_SEM_DOCUMENTO, extrairLigacoes, substituirLigacoes } from "./ligacoes";

describe("ligações entre documentos", () => {
  it("extrai os títulos sem repetir (ignora acento e caixa)", () => {
    expect(extrairLigacoes("Veja [[Captura de lead]] e [[captura de LEAD]] e [[Missão]].")).toEqual(["Captura de lead", "Missão"]);
    expect(extrairLigacoes(null)).toEqual([]);
  });

  it("troca por link do documento ou marca como ausente", () => {
    const r = substituirLigacoes("[[Funil]] e [[Outro]]", (t) => (t === "Funil" ? "abc" : null));
    expect(r).toBe(`[Funil](/processos/documentos/abc) e [Outro](${HREF_SEM_DOCUMENTO})`);
  });
});
