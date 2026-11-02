import { describe, expect, it } from "vitest";
import { esquemaEspaco, esquemaStatusLista } from "./estrutura";
import { esquemaAtualizarTarefa, esquemaNovaTarefa } from "./tarefa";

describe("esquemas de estrutura", () => {
  it("recusa espaço sem nome", () => {
    expect(esquemaEspaco.safeParse({ nome: "   ", cor: "#ff0000" }).success).toBe(false);
  });

  it("recusa cor fora de #RRGGBB e normaliza para minúsculas", () => {
    expect(esquemaEspaco.safeParse({ nome: "Marketing", cor: "red" }).success).toBe(false);
    expect(esquemaEspaco.parse({ nome: "Marketing", cor: "#FF8800" }).cor).toBe("#ff8800");
  });

  it("recusa tipo de status desconhecido", () => {
    const r = esquemaStatusLista.safeParse({
      listaId: "l1",
      status: [
        { nome: "A fazer", cor: "#aaaaaa", tipo: "aberto" },
        { nome: "Feito", cor: "#22c55e", tipo: "pronto" },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("esquemas de tarefa", () => {
  const base = {
    tarefaId: "t1",
    titulo: "Subir campanha de Black Friday paciente modelo",
    descricao: "",
    prioridade: "normal",
    dataInicio: "",
    dataEntrega: "2026-11-27",
    responsaveis: ["u1"],
  };

  it("recusa título só com espaços", () => {
    expect(esquemaNovaTarefa.safeParse({ listaId: "l1", titulo: "   " }).success).toBe(false);
  });

  it("converte datas do formulário e vazio em null", () => {
    const r = esquemaAtualizarTarefa.parse(base);
    expect(r.dataEntrega?.toISOString()).toBe("2026-11-27T00:00:00.000Z");
    expect(r.dataInicio).toBeNull();
    expect(r.descricao).toBeNull();
  });

  it("recusa início depois da entrega, apontando o campo de início", () => {
    const r = esquemaAtualizarTarefa.safeParse({ ...base, dataInicio: "2026-11-28" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["dataInicio"]);
  });
});
