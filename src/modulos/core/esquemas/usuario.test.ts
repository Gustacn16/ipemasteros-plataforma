import { describe, expect, it } from "vitest";
import { esquemaAceitarConvite, esquemaConvite, esquemaPerfil } from "./usuario";

describe("esquema de convite", () => {
  it("normaliza o e-mail", () => {
    const r = esquemaConvite.parse({ nome: "Ana Souza", email: "  Ana@IPEMaster.com.br ", papel: "colaborador" });
    expect(r.email).toBe("ana@ipemaster.com.br");
  });

  it("rejeita papel desconhecido", () => {
    expect(esquemaConvite.safeParse({ nome: "Ana", email: "a@b.com", papel: "dono" }).success).toBe(false);
  });
});

describe("esquema de aceite de convite", () => {
  const base = {
    token: "x".repeat(43),
    nome: "Ana Souza",
    apelido: "Ana",
    whatsapp: "(61) 99999-0000",
    cargo: "Social media",
    dataNascimento: "1995-04-10",
  };

  it("exige senha com no mínimo 10 caracteres", () => {
    const r = esquemaAceitarConvite.safeParse({ ...base, senha: "curta", confirmacao: "curta" });
    expect(r.success).toBe(false);
  });

  it("exige confirmação igual", () => {
    const r = esquemaAceitarConvite.safeParse({ ...base, senha: "senha-longa-1", confirmacao: "senha-longa-2" });
    expect(r.success).toBe(false);
  });

  it("aceita dados válidos", () => {
    const r = esquemaAceitarConvite.safeParse({ ...base, senha: "senha-longa-1", confirmacao: "senha-longa-1" });
    expect(r.success).toBe(true);
  });
});

describe("esquema de perfil", () => {
  const perfil = { nome: "Ana Souza", apelido: "Ana", whatsapp: "+55 61 99999-0000", cargo: "Social media", dataNascimento: "1995-04-10" };

  it("normaliza o WhatsApp", () => {
    expect(esquemaPerfil.parse(perfil).whatsapp).toBe("61999990000");
  });

  it("exige todos os campos", () => {
    for (const campo of ["apelido", "whatsapp", "cargo", "dataNascimento"] as const) {
      expect(esquemaPerfil.safeParse({ ...perfil, [campo]: "" }).success).toBe(false);
    }
  });

  it("recusa WhatsApp sem DDD e datas impossíveis", () => {
    expect(esquemaPerfil.safeParse({ ...perfil, whatsapp: "99999-0000" }).success).toBe(false);
    expect(esquemaPerfil.safeParse({ ...perfil, dataNascimento: "2024-01-01" }).success).toBe(false);
    expect(esquemaPerfil.safeParse({ ...perfil, dataNascimento: "1900-01-01" }).success).toBe(false);
  });
});
