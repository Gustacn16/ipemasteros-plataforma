import { describe, expect, it } from "vitest";
import { PLATAFORMAS } from "../esquemas/conteudo";
import { FORMATOS_INICIAIS, etapaInicialPermitida, rotuloCanalFormato } from "./formatos";

describe("formatos iniciais por plataforma", () => {
  it("toda plataforma tem pelo menos um formato, sem repetir nome", () => {
    for (const p of PLATAFORMAS) {
      expect(FORMATOS_INICIAIS[p].length).toBeGreaterThan(0);
      expect(new Set(FORMATOS_INICIAIS[p]).size).toBe(FORMATOS_INICIAIS[p].length);
    }
  });
  it("são os mesmos da migration", () => {
    expect(FORMATOS_INICIAIS.instagram).toEqual(["Reels", "Carrossel", "Post", "Story", "Live"]);
    expect(FORMATOS_INICIAIS.youtube).toEqual(["Vídeo", "Short", "Live"]);
    expect(FORMATOS_INICIAIS.podcast).toEqual(["Episódio"]);
  });
});

describe("rotuloCanalFormato", () => {
  it("canal e formato; sem formato avisa", () => {
    expect(rotuloCanalFormato({ plataforma: "youtube", formato: "Entrevista" })).toBe("YouTube · Entrevista");
    expect(rotuloCanalFormato({ plataforma: null, formato: null })).toBe("Sem formato");
  });
});

describe("etapaInicialPermitida", () => {
  it("ideia, planejado, a gravar e as seguintes; aprovado só para quem aprova", () => {
    expect(etapaInicialPermitida("ideia", false)).toBe(true);
    expect(etapaInicialPermitida("edicao", false)).toBe(true);
    expect(etapaInicialPermitida("aprovado", false)).toBe(false);
    expect(etapaInicialPermitida("aprovado", true)).toBe(true);
    expect(etapaInicialPermitida("publicado", true)).toBe(false);
    expect(etapaInicialPermitida("cancelado", true)).toBe(false);
  });
});
