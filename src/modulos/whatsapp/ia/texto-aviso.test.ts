import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  gasto: 0,
  limite: 1_000_000,
  registrar: vi.fn(async () => 1),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ia/uso", () => ({ gastoMesMicroUsd: async () => m.gasto, registrarUsoIa: m.registrar }));
vi.mock("../servicos/lote-ia", () => ({ ORIGEM_IA_WHATSAPP: "whatsapp" }));
vi.mock("../servicos/configuracao", () => ({ obterConfiguracaoWhatsapp: async () => ({ modelo: "claude-opus-5-5", limiteMensalMicroUsd: m.limite }) }));

import { MAX_TEXTO_AVISO } from "../regras/avisos";
import { escreverAviso } from "./texto-aviso";

const evento = { titulo: "Aula inaugural", dataInicio: new Date("2026-12-01T00:00:00.000Z"), horaInicio: "19:00", local: null, descricao: null };
const agora = new Date("2026-11-30T13:00:00Z");
const clienteCom = (texto: string) => ({ messages: { create: vi.fn(async () => ({ content: [{ type: "text", text: texto }], usage: {} })) } });

beforeEach(() => {
  m.gasto = 0;
  m.registrar.mockClear();
});

describe("escreverAviso", () => {
  it("usa a IA e registra o uso", async () => {
    const c = clienteCom("Olá turma");
    const r = await escreverAviso(evento, c as never, agora);
    expect(r).toEqual({ texto: "Olá turma", porIa: true });
    expect(m.registrar).toHaveBeenCalledWith(expect.objectContaining({ origem: "whatsapp" }));
  });
  it("sem verba usa o texto padrão e não chama o cliente", async () => {
    m.gasto = m.limite;
    const c = clienteCom("x");
    const r = await escreverAviso(evento, c as never, agora);
    expect(r.porIa).toBe(false);
    expect(r.texto).toContain("Aula inaugural");
    expect(c.messages.create).not.toHaveBeenCalled();
  });
  it("sem cliente usa o texto padrão", async () => {
    expect((await escreverAviso(evento, null, agora)).porIa).toBe(false);
  });
  it("se o cliente lança, usa o texto padrão", async () => {
    const c = { messages: { create: vi.fn(async () => { throw new Error("falhou"); }) } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await escreverAviso(evento, c as never, agora)).porIa).toBe(false);
  });
  it("corta no limite", async () => {
    const r = await escreverAviso(evento, clienteCom("a".repeat(MAX_TEXTO_AVISO + 50)) as never, agora);
    expect(r.texto).toHaveLength(MAX_TEXTO_AVISO);
  });
});
