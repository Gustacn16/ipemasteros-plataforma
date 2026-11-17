import { describe, expect, it } from "vitest";
import { esquemaNovoNumero } from "./numero";
import { esquemaEventoMotor, esquemaLoteEventos } from "./motor";

describe("esquemaNovoNumero", () => {
  it("escola sem usuário passa com usuarioId null", () => {
    const r = esquemaNovoNumero.safeParse({ nome: "Escola", finalidade: "escola" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.usuarioId).toBeNull();
  });
  it("escola descarta o usuário informado", () => {
    const r = esquemaNovoNumero.safeParse({ nome: "Escola", finalidade: "escola", usuarioId: "u1" });
    expect(r.success && r.data.usuarioId).toBeNull();
  });
  it("vendedor sem usuário falha", () => {
    const r = esquemaNovoNumero.safeParse({ nome: "Ana", finalidade: "vendedor", usuarioId: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Escolha o vendedor dono do número.");
  });
  it("vendedor com usuário passa", () => {
    const r = esquemaNovoNumero.safeParse({ nome: "Ana", finalidade: "vendedor", usuarioId: "u1" });
    expect(r.success && r.data.usuarioId).toBe("u1");
  });
  it("nome vazio falha", () => {
    expect(esquemaNovoNumero.safeParse({ nome: "  ", finalidade: "escola" }).success).toBe(false);
  });
  it("nome com 61 caracteres falha", () => {
    expect(esquemaNovoNumero.safeParse({ nome: "a".repeat(61), finalidade: "escola" }).success).toBe(false);
  });
});

describe("esquemaEventoMotor", () => {
  it("qr válido", () => {
    expect(esquemaEventoMotor.safeParse({ tipo: "qr", numeroId: "n1", qr: "abc" }).success).toBe(true);
  });
  it("conectado com telefone inválido falha", () => {
    expect(esquemaEventoMotor.safeParse({ tipo: "conectado", numeroId: "n1", telefone: "62 9999" }).success).toBe(false);
  });
  it("conectado com telefone válido", () => {
    expect(esquemaEventoMotor.safeParse({ tipo: "conectado", numeroId: "n1", telefone: "5562999999999" }).success).toBe(true);
  });
  it("desconectado e sinal válidos", () => {
    expect(esquemaEventoMotor.safeParse({ tipo: "desconectado", numeroId: "n1", motivo: "removido_no_celular" }).success).toBe(true);
    expect(esquemaEventoMotor.safeParse({ tipo: "sinal", conectados: ["n1"] }).success).toBe(true);
  });
  it("tipo desconhecido falha", () => {
    expect(esquemaEventoMotor.safeParse({ tipo: "xyz", numeroId: "n1" }).success).toBe(false);
  });
});

describe("esquemaLoteEventos", () => {
  const ev = { tipo: "sinal", conectados: [] };
  it("500 passa", () => {
    expect(esquemaLoteEventos.safeParse({ eventos: Array(500).fill(ev) }).success).toBe(true);
  });
  it("501 falha", () => {
    expect(esquemaLoteEventos.safeParse({ eventos: Array(501).fill(ev) }).success).toBe(false);
  });
});
