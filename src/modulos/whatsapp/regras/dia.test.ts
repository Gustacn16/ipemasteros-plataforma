import { describe, expect, it } from "vitest";
import { diaDaConsulta, janelaDeOntem, semanaDaConsulta, ultimasSemanas } from "./dia";

describe("janelaDeOntem", () => {
  it("janelaDeOntem às 02:00 UTC de 19/11 (23h do dia 18 em SP) devolve o dia 17", () => {
    const j = janelaDeOntem(new Date("2026-11-19T02:00:00Z"));
    expect(j.dia.toISOString()).toBe("2026-11-17T00:00:00.000Z");
    expect(j.inicio.toISOString()).toBe("2026-11-17T03:00:00.000Z");
    expect(j.fim.toISOString()).toBe("2026-11-18T03:00:00.000Z");
  });

  it("às 10:00 UTC de 19/11 devolve o dia 18", () => {
    const j = janelaDeOntem(new Date("2026-11-19T10:00:00Z"));
    expect(j.dia.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(j.fim.toISOString()).toBe("2026-11-19T03:00:00.000Z");
  });
});

describe("diaDaConsulta", () => {
  const agora = new Date("2026-11-18T15:00:00Z");
  it("aceita data válida e cai em ontem quando vazia ou inválida", () => {
    expect(diaDaConsulta("2026-11-10", agora).texto).toBe("2026-11-10");
    for (const ruim of [undefined, "", "abc", "2026-02-31", "2026-13-01", "10/11/2026"]) {
      expect(diaDaConsulta(ruim, agora).texto).toBe("2026-11-17");
    }
    expect(diaDaConsulta(undefined, agora).dia.toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
});

describe("semanas", () => {
  const agora = new Date("2026-11-19T15:00:00Z"); // quinta 19/11 em SP

  it("semanaDaConsulta(\"2026-11-16\") começa segunda 16/11 3h UTC", () => {
    const s = semanaDaConsulta("2026-11-16", new Date("2026-12-10T15:00:00Z"));
    expect(s.inicio.toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(s.fim.toISOString()).toBe("2026-11-23T03:00:00.000Z");
    expect(s.texto).toBe("2026-11-16");
    expect(s.rotulo).toBe("16/11 a 22/11");
  });

  it("semanaDaConsulta(\"2026-11-17\") (terça) vira a semana atual", () => {
    const atual = semanaDaConsulta(undefined, new Date("2026-12-02T15:00:00Z"));
    expect(atual.texto).toBe("2026-11-30");
    for (const ruim of ["2026-11-17", "", "abc", "2026-02-30"]) {
      expect(semanaDaConsulta(ruim, new Date("2026-12-02T15:00:00Z")).texto).toBe("2026-11-30");
    }
  });

  it("semana futura vira a semana atual", () => {
    expect(semanaDaConsulta("2026-11-23", agora).texto).toBe("2026-11-16");
  });

  it("domingo 23h em SP ainda é a semana que começou na segunda anterior", () => {
    expect(semanaDaConsulta(undefined, new Date("2026-11-23T02:30:00Z")).texto).toBe("2026-11-16");
    expect(semanaDaConsulta(undefined, new Date("2026-11-23T03:00:00Z")).texto).toBe("2026-11-23");
  });

  it("ultimasSemanas(agora, 8) tem 8 itens terminando na atual", () => {
    const lista = ultimasSemanas(agora, 8);
    expect(lista).toHaveLength(8);
    expect(lista[7].texto).toBe("2026-11-16");
    expect(lista[0].texto).toBe("2026-09-28");
    expect(lista[0].rotulo).toBe("28/09 a 04/10");
  });
});
