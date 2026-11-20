import { describe, expect, it } from "vitest";
import { REGRAS_PADRAO } from "../esquemas/regras-atendimento";
import type { MensagemTempo } from "./atendimento";
import { formatarNota, notaDeTempo, notaGeralDecimos, tipoDoTime } from "./avaliacao";

// Ontem = terça 17/11/2026 em São Paulo (UTC-3). Horário útil: seg-sex 8h-18h.
const ontem = { inicio: new Date("2026-11-17T03:00:00Z"), fim: new Date("2026-11-18T02:59:59Z") };
const c = (iso: string): MensagemTempo => ({ deMim: false, enviadaEm: new Date(iso) });
const e = (iso: string): MensagemTempo => ({ deMim: true, enviadaEm: new Date(iso) });

describe("notaDeTempo", () => {
  it("4 vezes ontem, 3 no SLA, dá 8", () => {
    const msgs = [
      c("2026-11-17T11:00:00Z"), e("2026-11-17T11:05:00Z"),
      c("2026-11-17T12:00:00Z"), e("2026-11-17T12:10:00Z"),
      c("2026-11-17T13:00:00Z"), e("2026-11-17T13:14:00Z"),
      c("2026-11-17T14:00:00Z"), e("2026-11-17T14:40:00Z"),
    ];
    expect(notaDeTempo(msgs, ontem, REGRAS_PADRAO)).toBe(8);
  });

  it("sem vez do cliente ontem devolve null", () => {
    expect(notaDeTempo([c("2026-11-16T11:00:00Z"), e("2026-11-16T11:05:00Z")], ontem, REGRAS_PADRAO)).toBeNull();
    expect(notaDeTempo([], ontem, REGRAS_PADRAO)).toBeNull();
  });

  it("vez aberta no fim de ontem conta fora do SLA", () => {
    const msgs = [c("2026-11-17T11:00:00Z"), e("2026-11-17T11:05:00Z"), c("2026-11-17T20:00:00Z")];
    expect(notaDeTempo(msgs, ontem, REGRAS_PADRAO)).toBe(5);
  });

  it("ignora vezes que começaram antes de ontem", () => {
    const msgs = [c("2026-11-16T11:00:00Z"), e("2026-11-16T13:00:00Z"), c("2026-11-17T11:00:00Z"), e("2026-11-17T11:05:00Z")];
    expect(notaDeTempo(msgs, ontem, REGRAS_PADRAO)).toBe(10);
  });
});

describe("notaGeralDecimos", () => {
  it("média das notas não nulas vezes 10", () => {
    expect(notaGeralDecimos([8, null, 6, 7])).toBe(70);
  });
  it("sem nota devolve null", () => {
    expect(notaGeralDecimos([null])).toBeNull();
    expect(notaGeralDecimos([])).toBeNull();
  });
});

describe("tipoDoTime", () => {
  it("mapeia os times", () => {
    expect(tipoDoTime("outro")).toBeNull();
    expect(tipoDoTime("comercial")).toBe("vendas");
    expect(tipoDoTime("paciente_modelo")).toBe("vendas");
    expect(tipoDoTime("cs")).toBe("cs");
  });
});

describe("formatarNota", () => {
  it("formata com vírgula", () => {
    expect(formatarNota(78)).toBe("7,8");
    expect(formatarNota(100)).toBe("10,0");
    expect(formatarNota(null)).toBe("—");
  });
});
