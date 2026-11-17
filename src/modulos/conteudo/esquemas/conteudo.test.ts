import { describe, expect, it } from "vitest";
import { esquemaAtualizarConteudo, esquemaMetricas, esquemaMudarEtapa, esquemaNovoConteudo, esquemaNovoFormato, filtroDoCookie } from "./conteudo";

describe("esquemas de conteúdo", () => {
  const base = {
    conteudoId: "c1",
    titulo: "Reels: 3 erros na prova de residência",
    formatoId: "f1",
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
    expect(r.legenda).toBeNull();
    expect(r.linkMaterial).toBeNull();
    expect(r.responsavelId).toBeNull();
    expect(r.dataGravacao).toBeNull();
    expect(r.dataPublicacao?.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("recusa link que não é http(s)", () => {
    expect(esquemaAtualizarConteudo.safeParse({ ...base, linkMaterial: "javascript:alert(1)" }).success).toBe(false);
    expect(esquemaAtualizarConteudo.safeParse({ ...base, linkMaterial: "https://drive.google.com/x" }).success).toBe(true);
  });

  it("novo conteúdo nasce como ideia, a não ser que venha a etapa da coluna", () => {
    const novo = { titulo: "Vlog da semana", formatoId: "f1", canalIds: [], dataPublicacao: "" };
    expect(esquemaNovoConteudo.parse(novo).etapa).toBe("ideia");
    expect(esquemaNovoConteudo.parse({ ...novo, etapa: "a_gravar" }).etapa).toBe("a_gravar");
    expect(esquemaNovoConteudo.safeParse({ ...novo, etapa: "publicado" }).success).toBe(false);
    expect(esquemaNovoConteudo.safeParse({ ...novo, formatoId: "" }).success).toBe(false);
  });

  it("nome do formato sem espaços nas pontas e com até 60 letras", () => {
    expect(esquemaNovoFormato.parse({ canalId: "k1", nome: "  Entrevista " }).nome).toBe("Entrevista");
    expect(esquemaNovoFormato.safeParse({ canalId: "k1", nome: " " }).success).toBe(false);
    expect(esquemaNovoFormato.safeParse({ canalId: "k1", nome: "x".repeat(61) }).success).toBe(false);
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
    expect(filtroDoCookie(JSON.stringify({ marca: "m1", formato: "cmformato1", etapa: "aprovado" }))).toEqual({
      marca: "m1",
      formato: "cmformato1",
      etapa: "aprovado",
    });
  });
  it("ignora campos inválidos e vazios (o formato antigo, da lista fixa, também)", () => {
    expect(filtroDoCookie(JSON.stringify({ marca: "", formato: "reels", etapa: "nada", responsavel: "u1" }))).toEqual({ responsavel: "u1" });
  });
  it("cookie ausente ou corrompido vira filtro vazio", () => {
    expect(filtroDoCookie(undefined)).toEqual({});
    expect(filtroDoCookie("{quebrado")).toEqual({});
    expect(filtroDoCookie("[1,2]")).toEqual({});
  });
});
