import { describe, expect, it } from "vitest";
import { categoriaInicial, chaveTelefone, decidirGuardar, dentroDoHistorico } from "./captura";

describe("chaveTelefone", () => {
  it("casa telefones brasileiros com ou sem 55 e com ou sem o 9", () => {
    for (const t of ["556281707432", "5562981707432", "62981707432", "6281707432", "(62) 98170-7432".replace(/\D/g, "")]) {
      expect(chaveTelefone(t)).toBe("6281707432");
    }
  });
  it("fora do Brasil devolve os dígitos como vieram", () => {
    expect(chaveTelefone("447911123456")).toBe("447911123456");
  });
  it("menos de 10 dígitos ou vazio dá null", () => {
    expect(chaveTelefone("123")).toBeNull();
    expect(chaveTelefone(null)).toBeNull();
    expect(chaveTelefone(undefined)).toBeNull();
  });
});

describe("categoriaInicial", () => {
  it("aluno, equipe e lead", () => {
    expect(categoriaInicial({ alunoId: "a", usuarioId: null })).toBe("aluno");
    expect(categoriaInicial({ alunoId: null, usuarioId: "u" })).toBe("equipe");
    expect(categoriaInicial({ alunoId: null, usuarioId: null })).toBe("lead");
  });
});

describe("decidirGuardar", () => {
  it("grupo monitorado guarda", () => {
    expect(decidirGuardar({ tipo: "grupo", monitorada: true, categoria: "lead" }, "ao_vivo")).toBe("guardar");
    expect(decidirGuardar({ tipo: "grupo", monitorada: true, categoria: "lead" }, "historico")).toBe("guardar");
  });
  it("grupo não monitorado: histórico provisória, ao vivo descarta", () => {
    expect(decidirGuardar({ tipo: "grupo", monitorada: false, categoria: "lead" }, "historico")).toBe("provisoria");
    expect(decidirGuardar({ tipo: "grupo", monitorada: false, categoria: "lead" }, "ao_vivo")).toBe("descartar");
  });
  it("individual pessoal descarta; outro guarda", () => {
    expect(decidirGuardar({ tipo: "individual", monitorada: false, categoria: "pessoal" }, "ao_vivo")).toBe("descartar");
    expect(decidirGuardar({ tipo: "individual", monitorada: false, categoria: "aluno" }, "ao_vivo")).toBe("guardar");
  });
});

describe("dentroDoHistorico", () => {
  const agora = new Date("2026-11-17T12:00:00Z");
  const diasAtras = (d: number) => new Date(agora.getTime() - d * 86_400_000);
  it("29 dias dentro, 31 fora", () => {
    expect(dentroDoHistorico(diasAtras(29), agora)).toBe(true);
    expect(dentroDoHistorico(diasAtras(31), agora)).toBe(false);
  });
});
