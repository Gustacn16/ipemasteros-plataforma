import { describe, expect, it } from "vitest";
import { gerarIcs, type EventoIcs } from "./ics";

const agora = new Date("2026-11-02T12:00:00.000Z");

const base: EventoIcs = {
  id: "ev1",
  titulo: "Recesso",
  descricao: null,
  local: null,
  turma: null,
  dataInicio: "2026-12-30",
  dataFim: "2027-01-02",
  horaInicio: null,
  horaFim: null,
  atualizadoEm: new Date("2026-11-01T10:00:00.000Z"),
};

const desdobrar = (ics: string) => ics.replace(/\r\n /g, "");
const linhas = (ics: string) => desdobrar(ics).split("\r\n");

describe("gerarIcs", () => {
  it("monta o calendário com cabeçalho e fuso fixos", () => {
    const l = linhas(gerarIcs([], agora));
    expect(l[0]).toBe("BEGIN:VCALENDAR");
    expect(l).toContain("VERSION:2.0");
    expect(l).toContain("PRODID:-//IPEMaster//Agenda//PT-BR");
    expect(l).toContain("X-WR-CALNAME:IPEMaster");
    expect(l).toContain("X-WR-TIMEZONE:America/Sao_Paulo");
    expect(l).toContain("TZID:America/Sao_Paulo");
    expect(l).toContain("TZOFFSETTO:-0300");
    expect(l).toContain("END:VCALENDAR");
  });

  it("evento de dia inteiro usa VALUE=DATE e DTEND exclusivo", () => {
    const l = linhas(gerarIcs([base], agora));
    expect(l).toContain("UID:ev1@ipemaster");
    expect(l).toContain("DTSTAMP:20261102T120000Z");
    expect(l).toContain("DTSTART;VALUE=DATE:20261230");
    expect(l).toContain("DTEND;VALUE=DATE:20270103");
  });

  it("evento com hora usa TZID de São Paulo", () => {
    const ev = { ...base, dataInicio: "2026-11-07", dataFim: "2026-11-07", horaInicio: "08:00", horaFim: "12:30" };
    const l = linhas(gerarIcs([ev], agora));
    expect(l).toContain("DTSTART;TZID=America/Sao_Paulo:20261107T080000");
    expect(l).toContain("DTEND;TZID=America/Sao_Paulo:20261107T123000");
  });

  it("coloca a turma entre parênteses no título", () => {
    const l = linhas(gerarIcs([{ ...base, turma: "T12" }], agora));
    expect(l).toContain("SUMMARY:Recesso (T12)");
  });

  it("escapa barra, ponto e vírgula, vírgula e quebra de linha", () => {
    const ev = { ...base, titulo: "Aula, módulo; 1", descricao: "a\\b\nc", local: "Sala 1, bloco; B" };
    const l = linhas(gerarIcs([ev], agora));
    expect(l).toContain("SUMMARY:Aula\\, módulo\; 1");
    expect(l).toContain("DESCRIPTION:a\\\\b\\nc");
    expect(l).toContain("LOCATION:Sala 1\\, bloco\; B");
  });

  it("dobra linhas em 75 octetos sem partir caractere e preserva o texto", () => {
    const descricao = "çãõéü 日本 ".repeat(30).slice(0, 200);
    expect(descricao).toHaveLength(200);
    const ics = gerarIcs([{ ...base, descricao }], agora);
    for (const l of ics.split("\r\n")) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(75);
    expect(ics).toMatch(/\r\n /);
    expect(linhas(ics)).toContain(`DESCRIPTION:${descricao}`);
  });

  it("usa só CRLF, sem LF solto", () => {
    const ics = gerarIcs([{ ...base, descricao: "x\ny" }], agora);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});
