import { describe, expect, it } from "vitest";
import {
  atrasosEnvio,
  escolherNumero,
  horarioSugerido,
  normalizarNome,
  semanaSeguinte,
  textoPadrao,
  validarJanela,
} from "./avisos";

describe("normalizarNome", () => {
  it("tira acento, caixa e espaços repetidos", () => {
    expect(normalizarNome("  Turma  Ávila 2026 ")).toBe("turma avila 2026");
  });
});

describe("semanaSeguinte", () => {
  it("numa terça devolve a segunda e o domingo da semana seguinte", () => {
    const s = semanaSeguinte(new Date("2026-11-24T13:00:00Z"));
    expect(s.inicio.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(s.fim.toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });
  it("numa segunda pula para a segunda seguinte", () => {
    const s = semanaSeguinte(new Date("2026-11-30T10:00:00Z"));
    expect(s.inicio.toISOString()).toBe("2026-12-07T00:00:00.000Z");
    expect(s.fim.toISOString()).toBe("2026-12-13T00:00:00.000Z");
  });
});

describe("horarioSugerido", () => {
  it("é a véspera às 9h de São Paulo", () => {
    expect(horarioSugerido(new Date("2026-12-03T00:00:00Z")).toISOString()).toBe("2026-12-02T12:00:00.000Z");
  });
});

describe("validarJanela", () => {
  it("aceita 10h com 30 grupos", () => {
    expect(validarJanela(new Date("2026-12-02T13:00:00Z"), 30)).toBeNull();
  });
  it("recusa antes das 8h", () => {
    expect(validarJanela(new Date("2026-12-02T10:00:00Z"), 5)).toContain("8h");
  });
  it("recusa quando o último envio passa das 20h", () => {
    expect(validarJanela(new Date("2026-12-02T22:55:00Z"), 30)).toContain("20h");
  });
  it("19h50 com 30 grupos fecha exatamente às 20h", () => {
    expect(validarJanela(new Date("2026-12-02T22:50:00Z"), 30)).toBeNull();
  });
  it("19h50m01s com 30 grupos passa das 20h", () => {
    expect(validarJanela(new Date("2026-12-02T22:50:01Z"), 30)).toContain("20h");
  });
  it("20h com 1 grupo passa das 20h", () => {
    expect(validarJanela(new Date("2026-12-02T23:00:00Z"), 1)).toContain("20h");
  });
  it("recusa mais de 30 grupos", () => {
    expect(validarJanela(new Date("2026-12-02T13:00:00Z"), 31)).toContain("30 grupos");
  });
  it("recusa nenhum grupo", () => {
    expect(validarJanela(new Date("2026-12-02T13:00:00Z"), 0)).toBe("Escolha ao menos um grupo.");
  });
});

describe("atrasosEnvio", () => {
  it("acumula 0, 8, 16 no mínimo", () => {
    expect(atrasosEnvio(3, () => 0)).toEqual([0, 8, 16]);
  });
  it("cada intervalo fica entre 8 e 20", () => {
    const a = atrasosEnvio(3, () => 0.999999);
    expect(a[0]).toBe(0);
    expect(a[1] - a[0]).toBeLessThanOrEqual(20);
    expect(a[2] - a[1]).toBeLessThanOrEqual(20);
    expect(a[1] - a[0]).toBeGreaterThanOrEqual(8);
  });
});

describe("textoPadrao", () => {
  it("só título e data", () => {
    const t = textoPadrao({ titulo: "Aula inaugural", dataInicio: new Date("2026-12-03T00:00:00Z"), horaInicio: null, local: null, descricao: null });
    expect(t).toBe("📢 Aula inaugural\n🗓️ quinta-feira, 03/12");
  });
  it("com todos os campos", () => {
    const t = textoPadrao({ titulo: "Aula", dataInicio: new Date("2026-12-03T00:00:00Z"), horaInicio: "19:00", local: "Sala 2", descricao: "Traga o jaleco" });
    expect(t).toBe("📢 Aula\n🗓️ quinta-feira, 03/12 às 19:00\n📍 Sala 2\nTraga o jaleco");
  });
});

describe("escolherNumero", () => {
  it("prefere o time cs", () => {
    expect(escolherNumero([{ id: "1", nome: "A", time: "comercial" }, { id: "2", nome: "Z", time: "cs" }])).toBe("2");
  });
  it("sem cs usa o primeiro por nome", () => {
    expect(escolherNumero([{ id: "1", nome: "B", time: "comercial" }, { id: "2", nome: "A", time: "outro" }])).toBe("2");
  });
  it("lista vazia dá null", () => {
    expect(escolherNumero([])).toBeNull();
  });
});
