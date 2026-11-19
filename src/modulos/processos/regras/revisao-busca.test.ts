import { describe, expect, it } from "vitest";
import { casaBusca, trechoDaBusca } from "./busca";
import { proximaRevisao, revisaoVencida } from "./revisao";

describe("revisão do padrão", () => {
  it("vence depois dos meses definidos", () => {
    const pub = new Date("2026-01-10T12:00:00Z");
    expect(proximaRevisao(pub, 6)?.toISOString().slice(0, 10)).toBe("2026-07-10");
    expect(revisaoVencida(pub, 6, new Date("2026-07-11T00:00:00Z"))).toBe(true);
    expect(revisaoVencida(pub, 6, new Date("2026-07-01T00:00:00Z"))).toBe(false);
    expect(revisaoVencida(pub, null, new Date("2030-01-01"))).toBe(false);
    expect(revisaoVencida(null, 6, new Date("2030-01-01"))).toBe(false);
  });
});

describe("busca", () => {
  it("ignora acento, caixa e ordem das palavras", () => {
    expect(casaBusca("Captura de Lead no Instagram", "instagram captura")).toBe(true);
    expect(casaBusca("Missão e visão", "missao")).toBe(true);
    expect(casaBusca("Funil", "lead")).toBe(false);
    expect(casaBusca("Funil", "  ")).toBe(false);
  });
  it("mostra um trecho em volta do termo", () => {
    const t = trechoDaBusca("## Etapas\nO **lead** chega pelo formulário.", "LEAD");
    expect(t).toContain("lead chega");
  });
});
