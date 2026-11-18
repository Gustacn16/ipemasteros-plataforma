import { describe, expect, it } from "vitest";
import {
  esquemaZodResumo,
  montarEntradaResumo,
  participacaoDoDia,
  pedidoResumo,
  type MensagemParaResumo,
} from "./resumo-grupo";

const msg = (o: Partial<MensagemParaResumo> = {}): MensagemParaResumo => ({
  enviadaEm: new Date("2026-11-17T13:05:00Z"),
  autor: "Ana",
  equipe: false,
  tipo: "texto",
  texto: "Oi",
  ...o,
});
const grupo = { nome: "Turma A", turma: "T1" };

describe("montarEntradaResumo", () => {
  it("linha da equipe leva (equipe) e mensagem própria vira Equipe IPEMaster (equipe)", () => {
    const { texto } = montarEntradaResumo(grupo, [
      msg({ autor: "Bia", equipe: true, texto: "Bom dia" }),
      msg({ autor: "Equipe IPEMaster", equipe: true, texto: "Aviso" }),
    ]);
    expect(texto).toContain("[10:05] Bia (equipe): Bom dia");
    expect(texto).toContain("[10:05] Equipe IPEMaster (equipe): Aviso");
  });

  it("áudio sem texto vira [áudio]", () => {
    const { texto } = montarEntradaResumo(grupo, [msg({ tipo: "audio", texto: null })]);
    expect(texto).toContain("Ana: [áudio]");
  });

  it("entrada acima de 120.000 caracteres é cortada nas mais antigas e avisa", () => {
    const ms = Array.from({ length: 2000 }, (_, i) =>
      msg({ enviadaEm: new Date(Date.UTC(2026, 10, 17, 12, 0, 0) + i * 1000), texto: `m${i} ${"x".repeat(100)}` }),
    );
    const r = montarEntradaResumo(grupo, ms);
    expect(r.cortada).toBe(true);
    expect(r.texto.length).toBeLessThanOrEqual(120_000);
    expect(r.texto).toContain("(Mensagens mais antigas do dia foram omitidas.)");
    expect(r.texto).toContain("m1999 ");
    expect(r.texto).not.toContain("m0 ");
  });

  it("entrada curta não é cortada nem avisa", () => {
    const r = montarEntradaResumo(grupo, [msg()]);
    expect(r.cortada).toBe(false);
    expect(r.texto).not.toContain("omitidas");
  });
});

describe("participacaoDoDia", () => {
  it("participação conta só quem não é da equipe, em ordem decrescente", () => {
    const r = participacaoDoDia([
      msg({ autor: "Ana" }),
      msg({ autor: "Caio" }),
      msg({ autor: "Caio" }),
      msg({ autor: "Bia", equipe: true }),
    ]);
    expect(r).toEqual([
      { autor: "Caio", mensagens: 2 },
      { autor: "Ana", mensagens: 1 },
    ]);
  });
});

describe("pedidoResumo", () => {
  it("pedido não tem telefone nem JID", () => {
    const { texto } = montarEntradaResumo(grupo, [msg({ autor: "Ana" }), msg({ autor: "Bia", equipe: true })]);
    const pedido = pedidoResumo("g1", "claude-opus-5-5", texto);
    const json = JSON.stringify(pedido);
    expect(json).not.toMatch(/\d{10,}/);
    expect(json).not.toContain("@s.whatsapp.net");
    expect(json).not.toContain("@g.us");
    expect(pedido.params.max_tokens).toBe(8000);
    expect(pedido.params.output_config.effort).toBe("medium");
    expect("thinking" in pedido.params).toBe(false);
  });
});

describe("esquemaZodResumo", () => {
  it("Zod recusa pendência sem hora", () => {
    const r = esquemaZodResumo.safeParse({
      resumo: "x",
      temas: [],
      pendencias: [{ autor: "Ana", texto: "Dúvida" }],
      destaques: [],
    });
    expect(r.success).toBe(false);
  });
});
