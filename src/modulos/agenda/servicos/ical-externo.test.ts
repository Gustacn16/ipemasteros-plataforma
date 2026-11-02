import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ErroNegocio } from "@/lib/erros";
import { buscarIcal, esquecerAgendaExterna, interpretarIcal, lerAgendaExterna } from "./ical-externo";

const fixture = (nome: string) => readFileSync(new URL(`./__fixtures__/${nome}`, import.meta.url), "utf8");
const iso = (d: Date) => d.toISOString();

function calendario(...eventos: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ficticio//Teste//PT", ...eventos, "END:VCALENDAR"].join("\r\n");
}
function diario(uid: string): string {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTAMP:20260101T000000Z",
    "DTSTART:20260101T120000Z",
    "DTEND:20260101T130000Z",
    "RRULE:FREQ=DAILY",
    `SUMMARY:Diário ${uid}`,
    "END:VEVENT",
  ].join("\r\n");
}

describe("interpretarIcal", () => {
  it("semanal com 1 EXDATE em novembro → 3 ocorrências", () => {
    const eventos = interpretarIcal(fixture("recorrente.ics"), "2026-11-01", "2026-11-30").filter(
      (e) => e.uid === "aula-semanal@ficticio.test",
    );
    expect(eventos.map((e) => [iso(e.inicio), iso(e.fim)])).toEqual([
      ["2026-11-03T13:00:00.000Z", "2026-11-03T14:00:00.000Z"],
      ["2026-11-10T13:00:00.000Z", "2026-11-10T14:00:00.000Z"],
      ["2026-11-24T13:00:00.000Z", "2026-11-24T14:00:00.000Z"],
    ]);
    expect(eventos[0]).toMatchObject({ titulo: "Aula de violão (fictícia)", local: "Sala 1", diaInteiro: false });
  });

  it("aplica ocorrência remarcada (RECURRENCE-ID) e omite a cancelada", () => {
    const eventos = interpretarIcal(fixture("recorrente.ics"), "2026-11-01", "2026-11-30").filter(
      (e) => e.uid === "reuniao@ficticio.test",
    );
    expect(eventos.map((e) => [iso(e.inicio), e.titulo])).toEqual([
      ["2026-11-05T18:00:00.000Z", "Reunião fictícia"],
      ["2026-11-13T19:00:00.000Z", "Reunião fictícia remarcada"],
      ["2026-11-26T18:00:00.000Z", "Reunião fictícia"],
    ]);
  });

  it("só expande dentro do intervalo pedido", () => {
    const eventos = interpretarIcal(fixture("recorrente.ics"), "2026-11-09", "2026-11-12").filter(
      (e) => e.uid === "aula-semanal@ficticio.test",
    );
    expect(eventos.map((e) => iso(e.inicio))).toEqual(["2026-11-10T13:00:00.000Z"]);
  });

  it("dia inteiro → diaInteiro: true, meia-noite de São Paulo e fim exclusivo", () => {
    const eventos = interpretarIcal(fixture("dia-inteiro.ics"), "2026-11-01", "2026-11-30");
    expect(eventos).toEqual([
      {
        uid: "feriado@ficticio.test",
        titulo: "Feriado fictício",
        inicio: new Date("2026-11-20T03:00:00Z"),
        fim: new Date("2026-11-21T03:00:00Z"),
        diaInteiro: true,
        local: null,
      },
      {
        uid: "viagem@ficticio.test",
        titulo: "(sem título)",
        inicio: new Date("2026-11-27T03:00:00Z"),
        fim: new Date("2026-11-30T03:00:00Z"),
        diaInteiro: true,
        local: "Cidade Fictícia",
      },
    ]);
  });

  it("evento 09:00 America/New_York → 14:00Z (e 13:00Z no horário de verão)", () => {
    const eventos = interpretarIcal(fixture("fuso-ny.ics"), "2026-07-01", "2026-11-30");
    expect(eventos.map((e) => [e.uid, iso(e.inicio), iso(e.fim)])).toEqual([
      ["call-ny-verao@ficticio.test", "2026-07-15T13:00:00.000Z", "2026-07-15T14:00:00.000Z"],
      ["call-ny@ficticio.test", "2026-11-10T14:00:00.000Z", "2026-11-10T15:00:00.000Z"],
    ]);
  });

  it("hora sem fuso (flutuante) é lida como São Paulo", () => {
    const texto = calendario(
      "BEGIN:VEVENT",
      "UID:flutuante@ficticio.test",
      "DTSTART:20261110T090000",
      "DTEND:20261110T100000",
      "SUMMARY:Flutuante",
      "END:VEVENT",
    );
    const [e] = interpretarIcal(texto, "2026-11-10", "2026-11-10");
    expect(iso(e.inicio)).toBe("2026-11-10T12:00:00.000Z");
  });

  it("RRULE diária sem fim num ano → 365 ocorrências exatas", () => {
    const eventos = interpretarIcal(calendario(diario("d0")), "2026-01-01", "2026-12-31");
    expect(eventos).toHaveLength(365);
    expect(iso(eventos[0].inicio)).toBe("2026-01-01T12:00:00.000Z");
    expect(iso(eventos[364].inicio)).toBe("2026-12-31T12:00:00.000Z");
  });

  it("intervalo de 1 ano com várias RRULE diárias sem fim → no máximo 2.000", () => {
    const texto = calendario(...["d1", "d2", "d3", "d4", "d5", "d6"].map(diario));
    expect(interpretarIcal(texto, "2026-01-01", "2026-12-31")).toHaveLength(2000);
  });

  it("título vazio vira (sem título) e evento sem DTEND dura zero", () => {
    const texto = calendario("BEGIN:VEVENT", "UID:x@ficticio.test", "DTSTART:20261110T120000Z", "END:VEVENT");
    const [e] = interpretarIcal(texto, "2026-11-10", "2026-11-10");
    expect(e.titulo).toBe("(sem título)");
    expect(iso(e.fim)).toBe("2026-11-10T12:00:00.000Z");
  });

  it("texto que não é iCal → ErroNegocio", () => {
    expect(() => interpretarIcal("<html></html>", "2026-11-01", "2026-11-30")).toThrow(ErroNegocio);
  });
});

const GOOGLE = "https://calendar.google.com/calendar/ical/ficticio%40gmail.com/private-000/basic.ics";
const ICS_MINIMO = calendario();

function respostaIcs(corpo = ICS_MINIMO, status = 200): Response {
  return new Response(corpo, { status, headers: { "content-type": "text/calendar" } });
}
function redirecionar(para: string): Response {
  return new Response(null, { status: 302, headers: { location: para } });
}

describe("buscarIcal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve o texto e usa redirect manual com timeout", async () => {
    fetchMock.mockResolvedValueOnce(respostaIcs());
    await expect(buscarIcal(GOOGLE)).resolves.toBe(ICS_MINIMO);
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(GOOGLE);
    expect(opcoes.redirect).toBe("manual");
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it("recusa URL fora da lista sem chamar a rede", async () => {
    await expect(buscarIcal("https://evil.com/calendar/ical/x")).rejects.toThrow(ErroNegocio);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirect para evil.com → erro, sem seguir", async () => {
    fetchMock.mockResolvedValueOnce(redirecionar("https://evil.com/roubar"));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("O endereço redirecionou para um lugar não permitido.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redirect para endereço interno (metadados) não passa", async () => {
    fetchMock.mockResolvedValueOnce(redirecionar("http://169.254.169.254/latest/meta-data"));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow(ErroNegocio);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("segue até 2 redirects permitidos", async () => {
    const outra = "https://calendar.google.com/calendar/ical/ficticio%40gmail.com/private-111/basic.ics";
    fetchMock
      .mockResolvedValueOnce(redirecionar(outra))
      .mockResolvedValueOnce(redirecionar("/calendar/ical/ficticio%40gmail.com/private-222/basic.ics"))
      .mockResolvedValueOnce(respostaIcs());
    await expect(buscarIcal(GOOGLE)).resolves.toBe(ICS_MINIMO);
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([
      GOOGLE,
      outra,
      "https://calendar.google.com/calendar/ical/ficticio%40gmail.com/private-222/basic.ics",
    ]);
  });

  it("mais de 2 redirects → erro", async () => {
    fetchMock.mockImplementation(async () => redirecionar(GOOGLE));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("O endereço redirecionou vezes demais.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("corpo de 6 MB → erro de tamanho", async () => {
    fetchMock.mockResolvedValueOnce(new Response("A".repeat(6 * 1024 * 1024), { status: 200 }));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("A agenda é grande demais (mais de 5 MB).");
  });

  it("corpo sem fim → para de ler logo acima de 5 MB e cancela o stream", async () => {
    const pedaco = new Uint8Array(1024 * 1024).fill(65);
    let enviados = 0;
    let cancelado = false;
    const corpo = new ReadableStream<Uint8Array>({
      pull(c) {
        enviados++;
        c.enqueue(pedaco);
      },
      cancel() {
        cancelado = true;
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(corpo, { status: 200 }));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("A agenda é grande demais (mais de 5 MB).");
    expect(cancelado).toBe(true);
    expect(enviados).toBeLessThanOrEqual(8);
  });

  it("Content-Length acima de 5 MB → erro de tamanho", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(ICS_MINIMO, { status: 200, headers: { "content-length": String(6 * 1024 * 1024) } }),
    );
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("A agenda é grande demais (mais de 5 MB).");
  });

  it("HTML → não é de uma agenda", async () => {
    fetchMock.mockResolvedValueOnce(respostaIcs("<!doctype html><html><body>Login</body></html>"));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("Este endereço não é de uma agenda.");
  });

  it("status de erro → mensagem com o status", async () => {
    fetchMock.mockResolvedValueOnce(respostaIcs("não achou", 404));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("O endereço respondeu com erro 404.");
  });

  it("timeout → demorou demais", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("tempo esgotado", "TimeoutError"));
    await expect(buscarIcal(GOOGLE)).rejects.toThrow("O endereço demorou demais para responder.");
  });

  it("falha de rede → mensagem curta, sem detalhes", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed ${GOOGLE}`));
    const erro = await buscarIcal(GOOGLE).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect((erro as Error).message).not.toContain("calendar.google.com");
  });
});

describe("lerAgendaExterna", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    fetchMock = vi.fn(async () => respostaIcs(fixture("fuso-ny.ics")));
    vi.stubGlobal("fetch", fetchMock);
    esquecerAgendaExterna("ag1");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("guarda o texto por 10 minutos por agenda", async () => {
    const a = await lerAgendaExterna("ag1", GOOGLE, "2026-11-01", "2026-11-30");
    expect(a.map((e) => e.uid)).toEqual(["call-ny@ficticio.test"]);
    await lerAgendaExterna("ag1", GOOGLE, "2026-07-01", "2026-07-31");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-02T12:09:59Z"));
    await lerAgendaExterna("ag1", GOOGLE, "2026-11-01", "2026-11-30");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-02T12:10:01Z"));
    await lerAgendaExterna("ag1", GOOGLE, "2026-11-01", "2026-11-30");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não guarda falhas", async () => {
    fetchMock.mockResolvedValueOnce(respostaIcs("erro", 500));
    await expect(lerAgendaExterna("ag1", GOOGLE, "2026-11-01", "2026-11-30")).rejects.toThrow("erro 500");
    await expect(lerAgendaExterna("ag1", GOOGLE, "2026-11-01", "2026-11-30")).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("URL nova na mesma agenda busca de novo", async () => {
    await lerAgendaExterna("ag1", GOOGLE, "2026-11-01", "2026-11-30");
    await lerAgendaExterna("ag1", GOOGLE.replace("000", "999"), "2026-11-01", "2026-11-30");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
