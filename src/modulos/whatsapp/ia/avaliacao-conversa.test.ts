import { describe, expect, it } from "vitest";
import {
  ESQUEMA_AVALIACAO_CS,
  ESQUEMA_AVALIACAO_VENDAS,
  INSTRUCOES_AVALIACAO,
  LIMITE_ENTRADA_AVALIACAO,
  esquemaZodAvaliacaoVendas,
  montarEntradaAvaliacao,
  pedidoAvaliacao,
  type MensagemParaAvaliacao,
} from "./avaliacao-conversa";

const msg = (o: Partial<MensagemParaAvaliacao> = {}): MensagemParaAvaliacao => ({
  enviadaEm: new Date("2026-11-18T13:05:00Z"),
  deMim: false,
  tipo: "texto",
  texto: "Oi",
  ...o,
});
const ontem = { inicio: new Date("2026-11-18T03:00:00Z"), fim: new Date("2026-11-19T02:59:59Z") };
const tempos = { primeiraRespostaMin: 3, respostaMin: 5, noSla: "4 de 5" };

describe("montarEntradaAvaliacao", () => {
  it("usa só os papéis Cliente e Atendente", () => {
    const { texto } = montarEntradaAvaliacao([msg({ texto: "Quero saber" }), msg({ deMim: true, texto: "Claro" })], ontem, tempos);
    expect(texto).toContain("[18/11 10:05] Cliente: Quero saber");
    expect(texto).toContain("[18/11 10:05] Atendente: Claro");
  });

  it("marca ontem antes da primeira mensagem de ontem e converte para São Paulo", () => {
    const { texto } = montarEntradaAvaliacao(
      [msg({ enviadaEm: new Date("2026-11-18T01:30:00Z"), texto: "antes" }), msg({ texto: "ontem" })],
      ontem,
      tempos,
    );
    expect(texto).toContain("[17/11 22:30] Cliente: antes");
    const i = texto.indexOf("--- Ontem (18/11) ---");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeGreaterThan(texto.indexOf("antes"));
    expect(i).toBeLessThan(texto.indexOf("ontem\n") === -1 ? texto.length : texto.indexOf("] Cliente: ontem"));
  });

  it("traz o bloco de tempos e rótulos de mídia", () => {
    const { texto } = montarEntradaAvaliacao([msg({ tipo: "audio", texto: null })], ontem, tempos);
    expect(texto).toContain("Tempos medidos pelo sistema (só para comentar)");
    expect(texto).toContain("Cliente: [áudio]");
  });

  it("acima do limite tira as mais antigas, avisa e mantém a última de ontem", () => {
    const grandes = Array.from({ length: 40 }, (_, i) =>
      msg({ enviadaEm: new Date(Date.UTC(2026, 10, 10, 12, i)), texto: "x".repeat(2_000) }),
    );
    const { texto, cortada } = montarEntradaAvaliacao([...grandes, msg({ texto: "ULTIMA" })], ontem, tempos);
    expect(cortada).toBe(true);
    expect(texto.length).toBeLessThanOrEqual(LIMITE_ENTRADA_AVALIACAO);
    expect(texto).toContain("(Mensagens mais antigas foram omitidas.)");
    expect(texto).toContain("ULTIMA");
    expect(texto).toContain("--- Ontem (18/11) ---");
  });
});

describe("corte dentro de ontem", () => {
  it("mantém o marcador logo antes da primeira de ontem que ficou", () => {
    const antigas = Array.from({ length: 5 }, (_, i) =>
      msg({ enviadaEm: new Date(Date.UTC(2026, 10, 10, 12, i)), texto: "a".repeat(2_000) }),
    );
    const deOntem = Array.from({ length: 40 }, (_, i) =>
      msg({ enviadaEm: new Date(Date.UTC(2026, 10, 18, 12, i)), texto: `O${i} ` + "y".repeat(2_000) }),
    );
    const { texto, cortada } = montarEntradaAvaliacao([...antigas, ...deOntem], ontem, tempos);
    expect(cortada).toBe(true);
    expect(texto.length).toBeLessThanOrEqual(LIMITE_ENTRADA_AVALIACAO);
    expect(texto).not.toContain("aaaa");
    const linhas = texto.split("\n");
    const m = linhas.indexOf("--- Ontem (18/11) ---");
    expect(m).toBeGreaterThan(-1);
    expect(linhas[m + 1]).toMatch(/Cliente: O\d+ /);
    expect(linhas[m + 1]).not.toContain("O0 ");
    expect(linhas.slice(0, m).some((l) => l.includes("Cliente: O"))).toBe(false);
  });

  it("encurta uma mensagem única maior que o limite", () => {
    const { texto } = montarEntradaAvaliacao([msg({ texto: "z".repeat(80_000) })], ontem, tempos);
    expect(texto.length).toBeLessThanOrEqual(LIMITE_ENTRADA_AVALIACAO);
    expect(texto).toContain("Cliente: zzz");
    expect(texto).toContain("--- Ontem (18/11) ---");
  });
});

const criteriosVendas = Object.fromEntries(
  ["qualificacao", "quebra_objecao", "followup", "clareza_cordialidade", "conducao_fechamento"].map((k) => [
    k,
    { seAplica: true, nota: 8, frase: "ok" },
  ]),
);
const baseVendas = {
  situacao: "negociando",
  temperatura: "quente",
  motivoTemperatura: "m",
  oQueRespondeu: "r",
  proximoPasso: "p",
  criterios: criteriosVendas,
  pontosFortes: ["a"],
  melhorar: ["b"],
};

describe("esquemaZodAvaliacaoVendas", () => {
  it("seAplica false vira nota null e nota 14 vira 10", () => {
    const r = esquemaZodAvaliacaoVendas.parse({
      ...baseVendas,
      criterios: {
        ...criteriosVendas,
        followup: { seAplica: false, nota: 5, frase: "" },
        qualificacao: { seAplica: true, nota: 14, frase: "x" },
      },
    });
    expect(r.criterios.followup.nota).toBeNull();
    expect(r.criterios.qualificacao.nota).toBe(10);
  });

  it("reprova situacao fora do enum", () => {
    expect(esquemaZodAvaliacaoVendas.safeParse({ ...baseVendas, situacao: "xyz" }).success).toBe(false);
  });
});

function todosObjetosFechados(no: unknown): boolean {
  if (!no || typeof no !== "object") return true;
  const o = no as Record<string, unknown>;
  if (o.type === "object" && o.additionalProperties !== false) return false;
  return Object.values(o).every(todosObjetosFechados);
}

describe("pedidoAvaliacao e esquemas", () => {
  it("pedido de CS", () => {
    const p = pedidoAvaliacao("aval_x", "cs", "texto");
    expect(p.custom_id).toBe("aval_x");
    expect(p.params.model).toBe("claude-sonnet-5-5");
    expect(p.params.output_config.effort).toBe("medium");
    expect(p.params.output_config.format.schema).toBe(ESQUEMA_AVALIACAO_CS);
    expect(p.params.system).toBe(INSTRUCOES_AVALIACAO.cs);
  });

  it("objetos têm additionalProperties false", () => {
    expect(todosObjetosFechados(ESQUEMA_AVALIACAO_VENDAS)).toBe(true);
    expect(todosObjetosFechados(ESQUEMA_AVALIACAO_CS)).toBe(true);
  });
});
