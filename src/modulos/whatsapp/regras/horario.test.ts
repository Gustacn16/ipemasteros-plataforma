import { describe, expect, it } from "vitest";
import { REGRAS_PADRAO } from "../esquemas/regras-atendimento";
import { formatarDuracao, segundosUteis } from "./horario";

const h = REGRAS_PADRAO.horario;
const d = (s: string) => new Date(`${s}-03:00`);

describe("segundosUteis", () => {
  it("segunda 9h00 a 9h12", () => {
    expect(segundosUteis(d("2026-11-16T09:00:00"), d("2026-11-16T09:12:00"), h)).toBe(720);
  });
  it("sexta 19h a sábado 8h05 (cliente escreve fora do horário)", () => {
    expect(segundosUteis(d("2026-11-20T19:00:00"), d("2026-11-21T08:05:00"), h)).toBe(300);
  });
  it("sexta 19h a segunda 8h05 inclui o sábado de manhã (4 h) quando o sábado está aberto", () => {
    expect(segundosUteis(d("2026-11-20T19:00:00"), d("2026-11-23T08:05:00"), h)).toBe(14700);
  });
  it("sexta 19h a segunda 8h05 com sábado fechado = 300", () => {
    const semSabado = [...h.slice(0, 6), null];
    expect(segundosUteis(d("2026-11-20T19:00:00"), d("2026-11-23T08:05:00"), semSabado)).toBe(300);
  });
  it("sábado 11h50 a segunda 8h10", () => {
    expect(segundosUteis(d("2026-11-21T11:50:00"), d("2026-11-23T08:10:00"), h)).toBe(1200);
  });
  it("domingo inteiro", () => {
    expect(segundosUteis(d("2026-11-22T00:00:00"), d("2026-11-23T00:00:00"), h)).toBe(0);
  });
  it("terça 17h a quarta 9h", () => {
    expect(segundosUteis(d("2026-11-17T17:00:00"), d("2026-11-18T09:00:00"), h)).toBe(7200);
  });
  it("fim antes do início", () => {
    expect(segundosUteis(d("2026-11-17T10:00:00"), d("2026-11-17T09:00:00"), h)).toBe(0);
  });
  it("usa o dia de São Paulo: 22h de domingo (01h UTC de segunda) não conta", () => {
    expect(segundosUteis(d("2026-11-22T22:00:00"), d("2026-11-23T08:30:00"), h)).toBe(1800);
  });
});

describe("formatarDuracao", () => {
  it("formata", () => {
    expect(formatarDuracao(null)).toBe("—");
    expect(formatarDuracao(30)).toBe("menos de 1 min");
    expect(formatarDuracao(540)).toBe("9 min");
    expect(formatarDuracao(43800)).toBe("12 h 10 min");
    expect(formatarDuracao(3900)).toBe("1 h 05 min");
  });
});
