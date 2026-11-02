import { describe, expect, it } from "vitest";
import { mascararUrl, validarUrlIcal } from "./url-ical";

const MENSAGEM = "Use o endereço secreto iCal do Google Agenda ou do Outlook.";
const GOOGLE = "https://calendar.google.com/calendar/ical/fulano%40gmail.com/private-abc123def456/basic.ics";

describe("validarUrlIcal", () => {
  it("aceita o endereço secreto do Google", () => {
    const r = validarUrlIcal(GOOGLE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.href).toBe(GOOGLE);
  });
  it("aceita webcal:// trocando para https://", () => {
    const r = validarUrlIcal("webcal://calendar.google.com/calendar/ical/x%40gmail.com/private-1/basic.ics");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url.protocol).toBe("https:");
      expect(r.url.href).toBe("https://calendar.google.com/calendar/ical/x%40gmail.com/private-1/basic.ics");
    }
  });
  it("aceita espaços em volta", () => {
    expect(validarUrlIcal(`  ${GOOGLE}  `).ok).toBe(true);
  });
  it("aceita o Outlook em /owa/calendar/", () => {
    expect(validarUrlIcal("https://outlook.office365.com/owa/calendar/abc@x.com/def/calendar.ics").ok).toBe(true);
    expect(validarUrlIcal("https://outlook.live.com/owa/calendar/00000000-0000/reachcalendar.ics").ok).toBe(true);
  });
  it.each([
    ["http://", "http://calendar.google.com/calendar/ical/x/basic.ics"],
    ["host parecido", "https://calendar.google.com.evil.com/calendar/ical/x/basic.ics"],
    ["IP", "https://192.168.0.1/calendar/ical/x"],
    ["porta", "https://calendar.google.com:8443/calendar/ical/x/basic.ics"],
    ["porta 443 explícita", "https://calendar.google.com:443/calendar/ical/x/basic.ics"],
    ["caminho de embed", "https://calendar.google.com/calendar/embed?src=x"],
    ["usuário e senha", "https://u:s@calendar.google.com/calendar/ical/x/basic.ics"],
    ["só usuário", "https://u@calendar.google.com/calendar/ical/x/basic.ics"],
    ["subdomínio", "https://evil.calendar.google.com/calendar/ical/x/basic.ics"],
    ["caminho do Outlook no Google", "https://calendar.google.com/owa/calendar/x"],
    ["caminho do Google no Outlook", "https://outlook.live.com/calendar/ical/x"],
    ["caminho com ..", "https://calendar.google.com/calendar/ical/../../evil"],
    ["outro protocolo", "ftp://calendar.google.com/calendar/ical/x"],
    ["texto qualquer", "não é url"],
    ["vazio", ""],
  ])("recusa %s", (_nome, texto) => {
    expect(validarUrlIcal(texto)).toEqual({ ok: false, mensagem: MENSAGEM });
  });
});

describe("mascararUrl", () => {
  it("mostra só o host e os últimos 6 caracteres", () => {
    expect(mascararUrl("https://calendar.google.com/calendar/ical/x/private-zzz/basica1b2c3")).toBe(
      "calendar.google.com …a1b2c3",
    );
  });
  it("não revela nada de um texto inválido", () => {
    expect(mascararUrl("lixo-secreto-123456")).toBe("…123456");
  });
});
