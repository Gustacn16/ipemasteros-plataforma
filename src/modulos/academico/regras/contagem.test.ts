import { describe, expect, it } from "vitest";
import { contarAtivos } from "./contagem";

describe("contarAtivos", () => {
  const m = (alunoId: string, turmaId: string, produtoId: string, situacao: "ativa" | "trancada" | "concluida" | "cancelada" = "ativa") => ({
    alunoId,
    turmaId,
    produtoId,
    situacao,
  });

  it("aluno em duas turmas do mesmo produto conta uma vez no produto", () => {
    const r = contarAtivos([m("a1", "t1", "p1"), m("a1", "t2", "p1"), m("a2", "t1", "p1")]);
    expect(r.porTurma.get("t1")).toBe(2);
    expect(r.porTurma.get("t2")).toBe(1);
    expect(r.porProduto.get("p1")).toBe(2);
    expect(r.total).toBe(2);
  });

  it("só matrícula ativa conta", () => {
    const r = contarAtivos([m("a1", "t1", "p1", "trancada"), m("a2", "t1", "p1", "concluida"), m("a3", "t2", "p2")]);
    expect(r.porTurma.get("t1")).toBeUndefined();
    expect(r.porProduto.get("p1")).toBeUndefined();
    expect(r.porProduto.get("p2")).toBe(1);
    expect(r.total).toBe(1);
  });

  it("o mesmo aluno em dois produtos conta em cada um, e uma vez no total", () => {
    const r = contarAtivos([m("a1", "t1", "p1"), m("a1", "t9", "p2")]);
    expect(r.porProduto.get("p1")).toBe(1);
    expect(r.porProduto.get("p2")).toBe(1);
    expect(r.total).toBe(1);
  });
});
