import { describe, expect, it } from "vitest";
import { esquemaAluno, esquemaMatricula, esquemaProfessor, esquemaTurma } from "./academico";

describe("esquemaAluno", () => {
  it("aceita CRM sem UF e normaliza telefone", () => {
    const a = esquemaAluno.parse({ nome: "Fulano de Tal", crm: "28117", telefone: "(62) 9999-0000" });
    expect(a).toMatchObject({ crm: "28117", crmUf: null, telefone: "6299990000", email: null });
  });

  it("recusa UF inexistente e e-mail inválido", () => {
    const r = esquemaAluno.safeParse({ nome: "Fulano", crmUf: "XX", email: "x@" });
    expect(r.success).toBe(false);
    const campos = r.error!.issues.map((i) => i.path[0]);
    expect(campos).toContain("crmUf");
    expect(campos).toContain("email");
  });
});

describe("esquemaTurma", () => {
  it("exige o produto", () => {
    expect(esquemaTurma.safeParse({ nome: "1ª turma" }).success).toBe(false);
  });

  it("fim antes do início é recusado", () => {
    const r = esquemaTurma.safeParse({ produtoId: "p", nome: "1ª turma", dataInicio: "2026-05-01", dataFim: "2026-01-01" });
    expect(r.success).toBe(false);
  });

  it("caixa marcada vira cíclica", () => {
    expect(esquemaTurma.parse({ produtoId: "p", nome: "Cíclica", ciclica: "on" }).ciclica).toBe(true);
  });
});

describe("esquemaMatricula", () => {
  it("recusa data impossível", () => {
    expect(esquemaMatricula.safeParse({ turmaId: "t", dataInicio: "2026-02-30" }).success).toBe(false);
  });
});

describe("data de nascimento", () => {
  it("aceita 29/02 em ano bissexto, recusa em ano comum, vazio vira null", () => {
    for (const esquema of [esquemaAluno, esquemaProfessor]) {
      expect(esquema.safeParse({ nome: "Ana", dataNascimento: "1990-02-29" }).success).toBe(false);
      expect(esquema.parse({ nome: "Ana", dataNascimento: "1992-02-29" }).dataNascimento).toBe("1992-02-29");
      expect(esquema.parse({ nome: "Ana", dataNascimento: "" }).dataNascimento).toBeNull();
    }
  });
});
