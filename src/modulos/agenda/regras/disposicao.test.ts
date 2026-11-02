import { describe, expect, it } from "vitest";
import { agruparPorDia, intervaloDaVisao, posicaoNaGrade, raiasDoDia, tituloDoPeriodo } from "./disposicao";

const item = (id: string, inicio: string, fim: string, horaInicio: string | null = null, horaFim: string | null = null) => ({
  id,
  titulo: id,
  inicio,
  fim,
  horaInicio,
  horaFim,
});

describe("intervaloDaVisao", () => {
  it("mês cobre a grade inteira, de domingo a sábado", () => {
    expect(intervaloDaVisao("mes", "2026-11-15")).toEqual({ de: "2026-11-01", ate: "2026-12-05" });
  });
  it("semana vai de domingo a sábado", () => {
    expect(intervaloDaVisao("semana", "2026-11-04")).toEqual({ de: "2026-11-01", ate: "2026-11-07" });
  });
  it("lista mostra 60 dias a partir da data", () => {
    expect(intervaloDaVisao("lista", "2026-11-02")).toEqual({ de: "2026-11-02", ate: "2026-12-31" });
  });
});

describe("tituloDoPeriodo", () => {
  it("mês por extenso com inicial maiúscula", () => {
    expect(tituloDoPeriodo("mes", "2026-11-20")).toBe("Novembro de 2026");
  });
  it("semana no mesmo mês", () => {
    expect(tituloDoPeriodo("semana", "2026-11-04")).toBe("1 a 7 de nov. de 2026");
  });
  it("semana que vira o ano", () => {
    expect(tituloDoPeriodo("semana", "2026-12-30")).toBe("27 de dez. de 2026 a 2 de jan. de 2027");
  });
  it("lista em meses diferentes", () => {
    expect(tituloDoPeriodo("lista", "2026-11-02")).toBe("2 de nov. a 31 de dez. de 2026");
  });
});

describe("agruparPorDia", () => {
  it("repete o evento de vários dias em cada dia, omite dias vazios e põe o dia inteiro antes", () => {
    const grupos = agruparPorDia(
      [item("b", "2026-12-31", "2026-12-31", "09:00", "10:00"), item("a", "2026-12-30", "2027-01-02"), item("c", "2027-01-05", "2027-01-05")],
      "2026-12-30",
      10,
    );
    expect(grupos.map((g) => [g.dia, g.itens.map((i) => i.id)])).toEqual([
      ["2026-12-30", ["a"]],
      ["2026-12-31", ["a", "b"]],
      ["2027-01-01", ["a"]],
      ["2027-01-02", ["a"]],
      ["2027-01-05", ["c"]],
    ]);
  });
});

describe("posicaoNaGrade", () => {
  it("posiciona entre 06:00 e 23:00", () => {
    const p = posicaoNaGrade("14:30", "16:12");
    expect(p.topo).toBeCloseTo(8.5 / 17);
    expect(p.altura).toBeCloseTo(1.7 / 17);
  });
  it("antes das 6 encosta no topo", () => {
    expect(posicaoNaGrade("04:00", "07:00")).toEqual({ topo: 0, altura: 1 / 17 });
  });
  it("tem altura mínima de 30 minutos e não passa das 23:00", () => {
    expect(posicaoNaGrade("10:00", "10:05").altura).toBeCloseTo(0.5 / 17);
    const tarde = posicaoNaGrade("23:30", "23:50");
    expect(tarde.topo + tarde.altura).toBeCloseTo(1);
  });
});

describe("raiasDoDia", () => {
  it("põe lado a lado só os que se sobrepõem", () => {
    const r = raiasDoDia([
      item("a", "d", "d", "08:00", "10:00"),
      item("b", "d", "d", "09:00", "11:00"),
      item("c", "d", "d", "12:00", "13:00"),
    ]);
    expect(r.map((x) => [x.item.id, x.raia, x.raias])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
  });
  it("ignora itens sem hora", () => {
    expect(raiasDoDia([item("a", "d", "d")])).toEqual([]);
  });
});
