import { describe, expect, it } from "vitest";
import { estadoNaTela, telefoneDoJid } from "./conexao";

const agora = new Date("2026-11-17T12:00:00Z");
const antes = (ms: number) => new Date(agora.getTime() - ms);
const base = { qrEm: null, ultimoSinalEm: antes(60_000), erro: null };

describe("estadoNaTela", () => {
  it("conectado com sinal recente", () => {
    expect(estadoNaTela({ ...base, situacao: "conectado" }, agora)).toBe("conectado");
  });
  it("conectado com sinal de 6 min é motor sem resposta", () => {
    expect(estadoNaTela({ ...base, situacao: "conectado", ultimoSinalEm: antes(6 * 60_000) }, agora)).toBe("motor_sem_resposta");
  });
  it("conectado com sinal nulo é motor sem resposta", () => {
    expect(estadoNaTela({ ...base, situacao: "conectado", ultimoSinalEm: null }, agora)).toBe("motor_sem_resposta");
  });
  it("aguardando QR com QR de 30 s", () => {
    expect(estadoNaTela({ ...base, situacao: "aguardando_qr", qrEm: antes(30_000) }, agora)).toBe("aguardando_qr");
  });
  it("aguardando QR com QR de 61 s expirou", () => {
    expect(estadoNaTela({ ...base, situacao: "aguardando_qr", qrEm: antes(61_000) }, agora)).toBe("qr_expirado");
  });
  it("aguardando QR sem qrEm continua aguardando", () => {
    expect(estadoNaTela({ ...base, situacao: "aguardando_qr" }, agora)).toBe("aguardando_qr");
  });
  it("erro com sinal recente", () => {
    expect(estadoNaTela({ ...base, situacao: "erro", erro: "falha" }, agora)).toBe("erro");
  });
  it("desconectado removido no celular", () => {
    expect(estadoNaTela({ ...base, situacao: "desconectado", erro: "removido_no_celular" }, agora)).toBe("removido_no_celular");
  });
  it("desconectado sem sinal", () => {
    expect(estadoNaTela({ ...base, situacao: "desconectado", ultimoSinalEm: null }, agora)).toBe("desconectado");
  });
});

describe("telefoneDoJid", () => {
  it("tira o sufixo de dispositivo", () => {
    expect(telefoneDoJid("5562999999999:12@s.whatsapp.net")).toBe("5562999999999");
  });
  it("jid simples", () => {
    expect(telefoneDoJid("5562999999999@s.whatsapp.net")).toBe("5562999999999");
  });
  it("jid que não é telefone", () => {
    expect(telefoneDoJid("abc@lid")).toBeNull();
  });
});
