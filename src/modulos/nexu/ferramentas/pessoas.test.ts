import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: mocks.findMany } } }));

const { ferramentaBuscarPessoas } = await import("./pessoas");
const ator = { id: "u0", nome: "Gustavo", papel: "admin" } as never;
const ctx = { conversaId: "c1", toolUseId: "t1" };

describe("buscar_pessoas", () => {
  it("acha sem diferenciar acento nem maiúscula e não usa LIKE no banco", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "u1", nome: "Luísa Andrade", papel: "colaborador" },
      { id: "u2", nome: "Marcos", papel: "comercial" },
      { id: "u3", nome: "Ana Luisa", papel: "gestor" },
    ]);
    const r = (await ferramentaBuscarPessoas.executar(ator, { nome: "  LUISA " }, ctx)) as { itens: { id: string }[]; total: number };
    expect(r.itens.map((p) => p.id)).toEqual(["u1", "u3"]);
    expect(r.total).toBe(2);
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ ativo: true });
  });

  it("devolve até 10 e informa o total", async () => {
    mocks.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `u${i}`, nome: `Pessoa ${i}`, papel: "colaborador" })));
    const r = (await ferramentaBuscarPessoas.executar(ator, { nome: "pessoa" }, ctx)) as { mostrando: number; total: number };
    expect(r).toMatchObject({ mostrando: 10, total: 12 });
  });
});
