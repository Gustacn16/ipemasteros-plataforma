import { describe, expect, it } from "vitest";
import { esquemaAtualizarConteudo, esquemaMetricas, esquemaMudarEtapa, filtroDoCookie } from "./conteudo";

describe("esquemas de conteúdo", () => {
  const base = {
    conteudoId: "c1",
    titulo: "Reels: 3 erros na prova de residência",
    formato: "reels",
    canalIds: ["k1"],
    dataPublicacao: "2026-11-27",
    roteiro: "  ",
    legenda: "",
    linkMaterial: "",
    responsavelId: "",
    dataGravacao: "",
  };

  it("normaliza campos vazios para null", () => {
    const r = esquemaAtualizarConteudo.parse(base);
    expect(r.roteiro).toBeNull();
    expect(r.linkMaterial).toBeNull();
    expect(r.responsavelId).toBeNull();
    expect(r.dataGravacao).toBeNull();
    expect(r.dataPublicacao?.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("recusa link que não é http(s)", () => {
    expect(esquemaAtualizarConteudo.safeParse({ ...base, linkMaterial: "javascript:alert(1)" }).success).toBe(false);
    expect(esquemaAtualizarConteudo.safeParse({ ...base, linkMaterial: "https://drive.google.com/x" }).success).toBe(true);
  });

  it("não aceita escolher publicado à mão", () => {
    expect(esquemaMudarEtapa.safeParse({ conteudoId: "c1", etapa: "publicado" }).success).toBe(false);
  });

  it("métricas aceitam vazio e recusam negativo", () => {
    const r = esquemaMetricas.parse({ publicacaoId: "p1", alcance: "1200", curtidas: "", comentarios: null });
    expect(r.alcance).toBe(1200);
    expect(r.curtidas).toBeNull();
    expect(esquemaMetricas.safeParse({ publicacaoId: "p1", alcance: "-3" }).success).toBe(false);
  });
});

describe("filtroDoCookie", () => {
  it("lê o filtro salvo", () => {
    expect(filtroDoCookie(JSON.stringify({ marca: "m1", formato: "reels", etapa: "aprovado" }))).toEqual({
      marca: "m1",
      formato: "reels",
      etapa: "aprovado",
    });
  });
  it("ignora campos inválidos e vazios", () => {
    expect(filtroDoCookie(JSON.stringify({ marca: "", formato: "xyz", etapa: "nada", responsavel: "u1" }))).toEqual({ responsavel: "u1" });
  });
  it("cookie ausente ou corrompido vira filtro vazio", () => {
    expect(filtroDoCookie(undefined)).toEqual({});
    expect(filtroDoCookie("{quebrado")).toEqual({});
    expect(filtroDoCookie("[1,2]")).toEqual({});
  });
});
