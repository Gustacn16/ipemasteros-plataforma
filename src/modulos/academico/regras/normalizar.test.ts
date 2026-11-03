import { describe, expect, it } from "vitest";
import { NOTA_FINALIZOU_PRATICAS, nomeBusca, normalizarCrm, normalizarSituacao, normalizarTurma, soDigitos } from "./normalizar";

describe("nomeBusca", () => {
  it("tira acento, caixa e espaços repetidos", () => {
    expect(nomeBusca("  Amélia   BEATRIZ ")).toBe("amelia beatriz");
  });
});

describe("soDigitos e normalizarCrm", () => {
  it("telefone fica só com dígitos, inclusive vindo como número", () => {
    expect(soDigitos("(62) 9999-0000")).toBe("6299990000");
    expect(soDigitos(6299990000)).toBe("6299990000");
    expect(soDigitos(" - ")).toBeNull();
  });

  it("CRM numérico do Excel vira texto sem casas decimais", () => {
    expect(normalizarCrm(28117)).toBe("28117");
    expect(normalizarCrm("28117.0")).toBe("28117");
    expect(normalizarCrm(" 12345-GO ")).toBe("12345-GO");
    expect(normalizarCrm(null)).toBeNull();
  });
});

describe("normalizarTurma", () => {
  it("unifica as formas de escrever o ordinal", () => {
    for (const v of ["4° turma", "4ª turma", "4º Turma", "4a turma", "4 turma"]) {
      expect(normalizarTurma(v)).toEqual({ nome: "4ª turma", ciclica: false });
    }
  });

  it("cíclico vira a turma Cíclica", () => {
    expect(normalizarTurma("cíclico")).toEqual({ nome: "Cíclica", ciclica: true });
    expect(normalizarTurma("Ciclica")).toEqual({ nome: "Cíclica", ciclica: true });
  });

  it("outro texto fica como veio; vazio é null", () => {
    expect(normalizarTurma(" Curso tricologia ")).toEqual({ nome: "Curso tricologia", ciclica: false });
    expect(normalizarTurma(" ")).toBeNull();
    expect(normalizarTurma(null)).toBeNull();
  });
});

describe("normalizarSituacao", () => {
  it("mapeia as situações da planilha", () => {
    expect(normalizarSituacao("Ativo ")).toEqual({ situacao: "ativa", nota: null });
    expect(normalizarSituacao("Formado")).toEqual({ situacao: "concluida", nota: null });
    expect(normalizarSituacao("Cancelado ")).toEqual({ situacao: "cancelada", nota: null });
    expect(normalizarSituacao("Trancado")).toEqual({ situacao: "trancada", nota: null });
  });

  it("quem finalizou as práticas segue ativo, com a nota", () => {
    expect(normalizarSituacao("Finalizou as práticas")).toEqual({ situacao: "ativa", nota: NOTA_FINALIZOU_PRATICAS });
  });

  it("valor desconhecido ou vazio é null", () => {
    expect(normalizarSituacao("xyz")).toBeNull();
    expect(normalizarSituacao(null)).toBeNull();
  });
});
