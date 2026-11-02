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

describe("permissões de Tarefas", () => {
  it("admin e gestor gerenciam espaços, veem todos e veem o relatório da equipe", () => {
    for (const papel of ["admin", "gestor"] as const) {
      expect(temPermissao(papel, "tarefas:gerenciar_espacos")).toBe(true);
      expect(temPermissao(papel, "tarefas:ver_todos_espacos")).toBe(true);
      expect(temPermissao(papel, "tarefas:ver_relatorio_equipe")).toBe(true);
    }
  });

  it("colaborador gerencia listas e usa tarefas, mas não cria espaços nem vê todos", () => {
    expect(temPermissao("colaborador", "tarefas:gerenciar_listas")).toBe(true);
    expect(temPermissao("colaborador", "tarefas:usar")).toBe(true);
    expect(temPermissao("colaborador", "tarefas:gerenciar_espacos")).toBe(false);
    expect(temPermissao("colaborador", "tarefas:ver_todos_espacos")).toBe(false);
    expect(temPermissao("colaborador", "tarefas:ver_relatorio_equipe")).toBe(false);
  });

  it("professor só usa tarefas; aluno não tem acesso", () => {
    expect(temPermissao("professor", "tarefas:usar")).toBe(true);
    expect(temPermissao("professor", "tarefas:gerenciar_listas")).toBe(false);
    expect(temPermissao("aluno", "tarefas:usar")).toBe(false);
  });
});

describe("permissões de Conteúdo", () => {
  it("admin e gestor aprovam e gerenciam canais", () => {
    for (const papel of ["admin", "gestor"] as const) {
      expect(temPermissao(papel, "conteudo:aprovar")).toBe(true);
      expect(temPermissao(papel, "conteudo:gerenciar_canais")).toBe(true);
    }
  });

  it("colaborador usa, mas não aprova nem gerencia canais", () => {
    expect(temPermissao("colaborador", "conteudo:usar")).toBe(true);
    expect(temPermissao("colaborador", "conteudo:aprovar")).toBe(false);
    expect(temPermissao("colaborador", "conteudo:gerenciar_canais")).toBe(false);
  });

  it("professor e aluno não acessam", () => {
    expect(temPermissao("professor", "conteudo:usar")).toBe(false);
    expect(temPermissao("aluno", "conteudo:usar")).toBe(false);
  });
});

describe("agenda", () => {
  const TODAS = [
    "agenda:usar",
    "agenda:ver_institucional",
    "agenda:ver_institucional_professor",
    "agenda:editar_institucional",
    "agenda:gerenciar_tipos",
  ] as const;

  it("admin e gestor têm as cinco permissões", () => {
    for (const papel of ["admin", "gestor"] as const) {
      for (const p of TODAS) expect(temPermissao(papel, p)).toBe(true);
    }
  });

  it("colaborador usa, vê e edita o institucional, mas não gerencia tipos", () => {
    expect(temPermissao("colaborador", "agenda:usar")).toBe(true);
    expect(temPermissao("colaborador", "agenda:ver_institucional")).toBe(true);
    expect(temPermissao("colaborador", "agenda:editar_institucional")).toBe(true);
    expect(temPermissao("colaborador", "agenda:ver_institucional_professor")).toBe(false);
    expect(temPermissao("colaborador", "agenda:gerenciar_tipos")).toBe(false);
  });

  it("professor só usa e vê o institucional de professor", () => {
    expect(temPermissao("professor", "agenda:usar")).toBe(true);
    expect(temPermissao("professor", "agenda:ver_institucional_professor")).toBe(true);
    expect(temPermissao("professor", "agenda:ver_institucional")).toBe(false);
    expect(temPermissao("professor", "agenda:editar_institucional")).toBe(false);
    expect(temPermissao("professor", "agenda:gerenciar_tipos")).toBe(false);
  });

  it("aluno não tem nenhuma", () => {
    for (const p of TODAS) expect(temPermissao("aluno", p)).toBe(false);
  });
});
