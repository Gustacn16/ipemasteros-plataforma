import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

// Banco de mentira: uma lista "l1" do espaço "e1", cujos membros atribuíveis são u1 e u2.
const banco = vi.hoisted(() => {
  const estado = { tarefa: null as null | Record<string, unknown>, responsaveis: [] as unknown[], transacoes: 0 };
  const tx = {
    tarefa: {
      aggregate: async () => ({ _max: { ordem: null } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        estado.tarefa = data;
        return { id: "t-nova", ...data };
      },
      createMany: async () => ({ count: 0 }),
    },
    tarefaResponsavel: {
      createMany: async ({ data }: { data: unknown[] }) => {
        estado.responsaveis = data;
        return { count: data.length };
      },
    },
  };
  const prisma = {
    statusLista: { findFirst: async () => ({ id: "s1" }) },
    $transaction: async (fn: (t: typeof tx) => unknown) => {
      estado.transacoes++;
      return fn(tx);
    },
  };
  return { prisma, estado };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("./detalhes", () => ({ listarEtiquetas: async () => [] }));
vi.mock("./acesso", () => ({
  MENSAGEM_NAO_ENCONTRADO: "Não encontrado.",
  exigirLista: async () => ({ id: "l1", espacoId: "e1" }),
  exigirPermissaoTarefas: () => undefined,
  exigirTarefa: async () => ({}),
  filtroTarefasVisiveis: () => ({}),
  podeEditarTarefa: () => true,
  podeExcluirTarefa: () => true,
  usuariosAtribuiveis: async () => [{ id: "u1" }, { id: "u2" }],
}));

const { criarTarefa } = await import("./tarefas");
const ator = { id: "u1", papel: "colaborador" } as UsuarioAtual;

describe("criar tarefa com responsáveis, prazo e descrição", () => {
  beforeEach(() => {
    banco.estado.tarefa = null;
    banco.estado.responsaveis = [];
    banco.estado.transacoes = 0;
  });

  it("responsável fora do espaço é recusado e nada é criado", async () => {
    await expect(criarTarefa(ator, { listaId: "l1", titulo: "X", responsaveis: ["u9"] })).rejects.toThrow(
      "Só é possível atribuir a membros do espaço.",
    );
    expect(banco.estado.transacoes).toBe(0);
    expect(banco.estado.tarefa).toBeNull();
  });

  it("grava prazo, descrição, prioridade e responsáveis na mesma transação", async () => {
    const dataEntrega = new Date("2026-11-20T00:00:00Z");
    await criarTarefa(ator, { listaId: "l1", titulo: "X", descricao: "Detalhes", prioridade: "alta", dataEntrega, responsaveis: ["u2", "u2", "u1"] });
    expect(banco.estado.transacoes).toBe(1);
    expect(banco.estado.tarefa).toMatchObject({ descricao: "Detalhes", prioridade: "alta", dataEntrega });
    expect(banco.estado.responsaveis).toEqual([
      { tarefaId: "t-nova", usuarioId: "u2" },
      { tarefaId: "t-nova", usuarioId: "u1" },
    ]);
  });

  it("sem os campos novos, tudo continua como antes", async () => {
    await criarTarefa(ator, { listaId: "l1", titulo: "X" });
    expect(banco.estado.tarefa).toMatchObject({ descricao: null, dataEntrega: null });
    expect(banco.estado.tarefa).not.toHaveProperty("prioridade");
    expect(banco.estado.responsaveis).toEqual([]);
  });
});
