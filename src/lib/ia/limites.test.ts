import { describe, expect, it } from "vitest";
import { avaliarLimites, inicioDoDiaSaoPaulo, inicioDoMesSaoPaulo } from "./limites";

describe("inicioDoDiaSaoPaulo", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    expect(inicioDoDiaSaoPaulo(new Date("2026-11-18T01:30:00Z")).toISOString()).toBe("2026-11-17T03:00:00.000Z");
  });
});

describe("inicioDoMesSaoPaulo", () => {
  it("ainda é novembro em São Paulo quando já é dezembro em UTC", () => {
    expect(inicioDoMesSaoPaulo(new Date("2026-12-01T02:00:00Z")).toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("avaliarLimites", () => {
  const base = { perguntasHoje: 0, perguntasPorDia: 50, gastoMesMicroUsd: 0, limiteMensalMicroUsd: 20_000_000 };
  it("libera e informa quantas restam", () => {
    expect(avaliarLimites({ ...base, perguntasHoje: 49 })).toEqual({ ok: true, restantesHoje: 1 });
  });
  it("bloqueia no limite do dia", () => {
    expect(avaliarLimites({ ...base, perguntasHoje: 50 })).toEqual({ ok: false, motivo: "dia" });
  });
  it("bloqueia quando o gasto iguala o limite do mês", () => {
    expect(avaliarLimites({ ...base, gastoMesMicroUsd: 20_000_000 })).toEqual({ ok: false, motivo: "mes" });
  });
  it("o mês vem antes do dia", () => {
    expect(avaliarLimites({ ...base, perguntasHoje: 50, gastoMesMicroUsd: 20_000_000 })).toEqual({ ok: false, motivo: "mes" });
  });
});
