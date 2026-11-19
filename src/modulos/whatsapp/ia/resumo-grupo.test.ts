import { describe, expect, it } from "vitest";
import {
  ESQUEMA_RESUMO,
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
    expect(pedido.params.max_tokens).toBe(16_000);
    expect(pedido.params.output_config.effort).toBe("medium");
    expect("thinking" in pedido.params).toBe(false);
  });
});

describe("esquemaZodResumo", () => {
  const base = { resumo: "x", temas: [], destaques: [] };

  it("Zod recusa pendência sem a chave hora", () => {
    const r = esquemaZodResumo.safeParse({ ...base, pendencias: [{ autor: "Ana", texto: "Dúvida" }] });
    expect(r.success).toBe(false);
  });

  it("hora inválida vira vazia e hora válida é mantida", () => {
    const r = esquemaZodResumo.parse({
      ...base,
      pendencias: [
        { autor: "Ana", hora: "25:99", texto: "a" },
        { autor: "Bia", hora: "09:30", texto: "b" },
      ],
    });
    expect(r.pendencias.map((p) => p.hora)).toEqual(["", "09:30"]);
  });

  it("listas acima do limite são aparadas", () => {
    const r = esquemaZodResumo.parse({
      resumo: "x",
      temas: Array(9).fill("t"),
      destaques: Array(8).fill("d"),
      pendencias: Array(20).fill({ autor: "A", hora: "10:00", texto: "t" }),
    });
    expect([r.temas.length, r.pendencias.length, r.destaques.length]).toEqual([6, 15, 5]);
  });
});

describe("ESQUEMA_RESUMO", () => {
  it("não usa restrições que a API de saída estruturada não suporta", () => {
    const proibidas = ["maxItems", "minItems", "pattern", "minLength", "maxLength"];
    const achadas: string[] = [];
    const andar = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(andar);
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (proibidas.includes(k)) achadas.push(k);
          andar(x);
        }
      }
    };
    andar(ESQUEMA_RESUMO);
    expect(achadas).toEqual([]);
  });
});
