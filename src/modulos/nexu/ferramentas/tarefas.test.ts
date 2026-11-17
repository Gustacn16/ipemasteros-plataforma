import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

const banco = vi.hoisted(() => ({ findMany: vi.fn(), eventos: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { tarefa: { findMany: banco.findMany } } }));
vi.mock("@/modulos/agenda/servicos/eventos", () => ({ listarEventos: banco.eventos }));

const { ferramentaBuscarTarefas } = await import("./tarefas");
const { ferramentaVerAgenda } = await import("./agenda");
const { ErroNegocio } = await import("@/lib/erros");

const ator = { id: "u1", nome: "Ana", papel: "colaborador" } as UsuarioAtual;
const ctx = { conversaId: "c1", toolUseId: "t1" };

beforeEach(() => {
  banco.findMany.mockReset();
  banco.eventos.mockReset();
});

describe("buscar_tarefas", () => {
  it("atrasadas usa o filtro de tarefas visíveis e pede entrega anterior a hoje, só abertas", async () => {
    banco.findMany.mockResolvedValue([
      {
        id: "t1",
        titulo: "Gravar aula",
        dataEntrega: new Date("2020-01-02T00:00:00.000Z"),
        concluidaEm: null,
        status: { nome: "Fazendo" },
        lista: { nome: "Aulas", espaco: { nome: "Conteúdo" } },
        responsaveis: [{ usuario: { nome: "Ana" } }],
      },
    ]);
    const r = (await ferramentaBuscarTarefas.executar(ator, { escopo: "visiveis", atrasadas: true }, ctx)) as {
      itens: unknown[];
      total: number;
    };
    const where = banco.findMany.mock.calls[0][0].where as { AND: Record<string, unknown>[] };
    expect(where.AND[0]).toMatchObject({ excluidoEm: null, lista: { excluidoEm: null } });
    expect(where.AND[0].OR).toBeDefined();
    const entrega = where.AND.find((c) => "dataEntrega" in c) as { dataEntrega: { lt: Date } };
    expect(entrega.dataEntrega.lt).toBeInstanceOf(Date);
    expect(where.AND).toContainEqual({ concluidaEm: null });
    expect(r.total).toBe(1);
    expect(r.itens[0]).toEqual({
      id: "t1",
      titulo: "Gravar aula",
      lista: "Aulas",
      espaco: "Conteúdo",
      status: "Fazendo",
      responsaveis: ["Ana"],
      dataEntrega: "2020-01-02",
      atrasada: true,
    });
  });
});

describe("ver_agenda", () => {
  it("recusa período de 63 dias", async () => {
    await expect(ferramentaVerAgenda.executar(ator, { de: "2026-01-01", ate: "2026-03-04" }, ctx)).rejects.toBeInstanceOf(ErroNegocio);
    expect(banco.eventos).not.toHaveBeenCalled();
  });

  it("aceita 62 dias e devolve eventos compactos", async () => {
    banco.eventos.mockResolvedValue([]);
    const r = await ferramentaVerAgenda.executar(ator, { de: "2026-01-01", ate: "2026-03-03" }, ctx);
    expect(r).toEqual({ itens: [], total: 0, mostrando: 0 });
  });
});
