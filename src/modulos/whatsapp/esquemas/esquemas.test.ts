import { describe, expect, it } from "vitest";
import { esquemaNovoNumero } from "./numero";
import { esquemaEventoMotor, esquemaLoteEventos } from "./motor";
import { REGRAS_PADRAO, esquemaRegrasAtendimento } from "./regras-atendimento";

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

describe("eventos conversas e mensagens", () => {
  const msg = { idExterno: "m1", jid: "120363@g.us", deMim: false, tipo: "texto", enviadaEm: "2026-11-17T12:00:00.000Z" };
  const evMsg = (mensagens: unknown[], extra: object = {}) =>
    esquemaEventoMotor.safeParse({ tipo: "mensagens", numeroId: "n1", origem: "ao_vivo", mensagens, ...extra });
  it("conversas válido passa", () => {
    const r = esquemaEventoMotor.safeParse({
      tipo: "conversas",
      numeroId: "n1",
      conversas: [{ jid: "120363@g.us", tipo: "grupo", nome: "Turma" }, { jid: "5562981707432@s.whatsapp.net", tipo: "individual" }, { jid: "123@lid", tipo: "individual" }],
    });
    expect(r.success).toBe(true);
  });
  it("mensagens válido passa", () => {
    expect(evMsg([{ ...msg, texto: "oi", autorTelefone: "5562981707432", autorNome: "Ana" }]).success).toBe(true);
  });
  it("101 mensagens falha", () => {
    expect(evMsg(Array(101).fill(msg)).success).toBe(false);
    expect(evMsg(Array(100).fill(msg)).success).toBe(true);
  });
  it("texto com 4001 caracteres falha", () => {
    expect(evMsg([{ ...msg, texto: "a".repeat(4001) }]).success).toBe(false);
    expect(evMsg([{ ...msg, texto: "a".repeat(4000) }]).success).toBe(true);
  });
  it("jid status@broadcast falha", () => {
    expect(evMsg([{ ...msg, jid: "status@broadcast" }]).success).toBe(false);
  });
  it("jid sem parte local ou com espaço falha", () => {
    expect(evMsg([{ ...msg, jid: "@g.us" }]).success).toBe(false);
    expect(evMsg([{ ...msg, jid: "a b@lid" }]).success).toBe(false);
    expect(evMsg([{ ...msg, autorJid: "a b@lid" }]).success).toBe(false);
  });
  it("enviadaEm não-ISO falha", () => {
    expect(evMsg([{ ...msg, enviadaEm: "ontem" }]).success).toBe(false);
  });
  it("autorTelefone com espaço falha", () => {
    expect(evMsg([{ ...msg, autorTelefone: "62 9999" }]).success).toBe(false);
  });
  it("tipo de mensagem desconhecido falha", () => {
    expect(evMsg([{ ...msg, tipo: "reacao" }]).success).toBe(false);
  });
});

describe("esquemaRegrasAtendimento", () => {
  it("toda mensagem de número fora da faixa ou quebrado sai em português", () => {
    const faixa = (f: Record<string, number>) => [{ ...REGRAS_PADRAO.horario[1]!, ...f }, ...REGRAS_PADRAO.horario.slice(1)];
    const casos = [
      { horario: faixa({ inicioMin: 1.5 }) },
      { horario: faixa({ inicioMin: 2000 }) },
      { horario: faixa({ fimMin: 600.5 }) },
      { horario: faixa({ fimMin: -1 }) },
      { slaMinutos: 1.5 },
      { followupHoras: 1.5 },
      { followupDias: 1.5 },
    ];
    for (const caso of casos) {
      const r = esquemaRegrasAtendimento.safeParse({ ...REGRAS_PADRAO, ...caso });
      expect(r.success, JSON.stringify(caso)).toBe(false);
      for (const issue of r.error!.issues) expect(issue.message, JSON.stringify(caso)).toMatch(/^(O|A|Informe) /);
    }
  });

  it("aceita REGRAS_PADRAO", () => {
    expect(esquemaRegrasAtendimento.safeParse(REGRAS_PADRAO).success).toBe(true);
  });
  it("recusa faixa com inicioMin >= fimMin", () => {
    const horario = [...REGRAS_PADRAO.horario];
    horario[1] = { inicioMin: 600, fimMin: 600 };
    expect(esquemaRegrasAtendimento.safeParse({ ...REGRAS_PADRAO, horario }).success).toBe(false);
  });
  it("recusa horario com 6 posições", () => {
    expect(esquemaRegrasAtendimento.safeParse({ ...REGRAS_PADRAO, horario: REGRAS_PADRAO.horario.slice(0, 6) }).success).toBe(false);
  });
  it("recusa slaMinutos 0", () => {
    expect(esquemaRegrasAtendimento.safeParse({ ...REGRAS_PADRAO, slaMinutos: 0 }).success).toBe(false);
  });
  it("recusa followupDias 1 com followupHoras 24", () => {
    expect(esquemaRegrasAtendimento.safeParse({ ...REGRAS_PADRAO, followupDias: 1, followupHoras: 24 }).success).toBe(false);
  });
});
