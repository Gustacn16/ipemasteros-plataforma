import { describe, expect, it } from "vitest";
import { PAPEIS, papeisConvidaveis, podeConvidar, temPermissao } from "./permissoes";

describe("permissões do Core", () => {
  it("admin tem todas as permissões do Core", () => {
    for (const p of [
      "core:ver_usuarios",
      "core:convidar_usuario",
      "core:alterar_papel",
      "core:desativar_usuario",
      "core:ver_auditoria",
    ] as const) {
      expect(temPermissao("admin", p)).toBe(true);
    }
  });

  it("gestor vê e convida, mas não altera papel nem desativa", () => {
    expect(temPermissao("gestor", "core:ver_usuarios")).toBe(true);
    expect(temPermissao("gestor", "core:convidar_usuario")).toBe(true);
    expect(temPermissao("gestor", "core:alterar_papel")).toBe(false);
    expect(temPermissao("gestor", "core:desativar_usuario")).toBe(false);
  });

  it("colaborador, professor e aluno não acessam a administração", () => {
    for (const papel of ["colaborador", "professor", "aluno"] as const) {
      expect(temPermissao(papel, "core:ver_usuarios")).toBe(false);
      expect(temPermissao(papel, "core:ver_auditoria")).toBe(false);
    }
  });
});

describe("quem pode convidar quem", () => {
  it("só admin convida admin ou gestor", () => {
    expect(podeConvidar("admin", "admin")).toBe(true);
    expect(podeConvidar("admin", "gestor")).toBe(true);
    expect(podeConvidar("gestor", "admin")).toBe(false);
    expect(podeConvidar("gestor", "gestor")).toBe(false);
  });

  it("gestor convida colaborador e professor", () => {
    expect(papeisConvidaveis("gestor")).toEqual(["colaborador", "professor"]);
  });

  it("ninguém convida aluno (sem login na v1)", () => {
    for (const papel of PAPEIS) expect(podeConvidar(papel, "aluno")).toBe(false);
  });
});
