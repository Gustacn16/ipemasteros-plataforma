import { describe, expect, it } from "vitest";
import { esquemaAceitarConvite, esquemaConvite } from "./usuario";

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
  const base = { token: "x".repeat(43), nome: "Ana Souza" };

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
