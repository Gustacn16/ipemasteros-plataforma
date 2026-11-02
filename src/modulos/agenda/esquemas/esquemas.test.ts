import { describe, expect, it } from "vitest";
import { esquemaEvento, esquemaLote, esquemaTipo, esquemaPeriodo, filtroDoCookie } from "./agenda";

const base = { tipoId: "t1", titulo: "Aula", visivelProfessores: false };

function caminhos(r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (r.error?.issues ?? []).map((i) => i.path.join("."));
}

describe("esquemaPeriodo", () => {
  it("aceita dia inteiro", () => {
    expect(esquemaPeriodo.safeParse({ dataInicio: "2026-11-07", dataFim: "2026-11-08", horaInicio: null, horaFim: null }).success).toBe(true);
  });
  it("recusa formato e data inexistente", () => {
    expect(esquemaPeriodo.safeParse({ dataInicio: "7/11/2026", dataFim: "2026-11-08", horaInicio: null, horaFim: null }).success).toBe(false);
    expect(esquemaPeriodo.safeParse({ dataInicio: "2026-02-30", dataFim: "2026-03-01", horaInicio: null, horaFim: null }).success).toBe(false);
  });
});

describe("esquemaEvento", () => {
  it("hora só de início dá erro em horaFim", () => {
    const r = esquemaEvento.safeParse({ ...base, dataInicio: "2026-11-07", dataFim: "2026-11-07", horaInicio: "09:00", horaFim: null });
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain("horaFim");
  });
  it("fim antes do início dá erro em dataFim", () => {
    const r = esquemaEvento.safeParse({ ...base, dataInicio: "2026-11-08", dataFim: "2026-11-07", horaInicio: null, horaFim: null });
    expect(caminhos(r)).toContain("dataFim");
  });
});

describe("esquemaLote", () => {
  const lote = (periodos: { dataInicio: string; dataFim: string }[]) => ({
    ...base, horaInicio: null, horaFim: null, numerar: true, periodos,
  });
  it("recusa 31 períodos", () => {
    const periodos = Array.from({ length: 31 }, (_, i) => {
      const d = `2027-01-${String(i + 1).padStart(2, "0")}`;
      return { dataInicio: d, dataFim: d };
    });
    expect(esquemaLote.safeParse(lote(periodos)).success).toBe(false);
  });
  it("data repetida dá erro em periodos.1", () => {
    const r = esquemaLote.safeParse(lote([
      { dataInicio: "2026-11-07", dataFim: "2026-11-07" },
      { dataInicio: "2026-11-07", dataFim: "2026-11-08" },
    ]));
    expect(r.success).toBe(false);
    expect(caminhos(r)).toContain("periodos.1");
    expect(JSON.stringify(r.error)).toContain("Esta data já está no lote.");
  });
  it("aceita lote válido", () => {
    expect(esquemaLote.safeParse(lote([{ dataInicio: "2026-11-07", dataFim: "2026-11-08" }])).success).toBe(true);
  });
});

describe("esquemaTipo", () => {
  it("recusa cor 'roxo'", () => {
    expect(esquemaTipo.safeParse({ nome: "X", cor: "roxo" }).success).toBe(false);
    expect(esquemaTipo.safeParse({ nome: "X", cor: "#5F45F4" }).success).toBe(true);
  });
});

describe("filtroDoCookie", () => {
  const padrao = { tipos: [], tarefas: true, desligadas: [] };
  it("lixo ou vazio vira o padrão", () => {
    expect(filtroDoCookie("lixo")).toEqual(padrao);
    expect(filtroDoCookie(undefined)).toEqual(padrao);
  });
  it("preserva tipos", () => {
    const f = filtroDoCookie(JSON.stringify({ visao: "semana", tipos: ["a", "b"], tarefas: false, desligadas: ["x"] }));
    expect(f).toEqual({ visao: "semana", tipos: ["a", "b"], tarefas: false, desligadas: ["x"] });
  });
});
