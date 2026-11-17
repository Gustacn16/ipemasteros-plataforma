import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ehPerguntaDoUsuario, montarPedido, PROMPT_SISTEMA, semMensagensVazias, tiraTurnoIncompleto } from "./prompt";

const ferramentas: Anthropic.Tool[] = [
  { name: "a", description: "A", input_schema: { type: "object" } },
  { name: "b", description: "B", input_schema: { type: "object" } },
];

const pedido = montarPedido({
  modelo: "claude-haiku-5-5",
  ferramentas,
  historico: [],
  contexto: { agora: new Date("2026-11-17T15:30:00.000Z"), nome: "Ana", papel: "colaborador", tela: "/tarefas/abc" },
  pergunta: "Quais tarefas estão atrasadas?",
});

describe("montarPedido", () => {
  it("põe cache no prompt de sistema e na última ferramenta, sem data no sistema", () => {
    expect(Array.isArray(pedido.system)).toBe(true);
    const sistema = pedido.system as Anthropic.TextBlockParam[];
    expect(sistema.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
    expect(sistema[0].text).toBe(PROMPT_SISTEMA);
    expect(JSON.stringify(pedido.system)).not.toContain("2026");
    const tools = pedido.tools as Anthropic.Tool[];
    expect(tools.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
    expect(tools[0].cache_control).toBeUndefined();
    expect(ferramentas[1].cache_control).toBeUndefined();
  });

  it("usa effort low, max_tokens 4000 e não manda temperature nem thinking", () => {
    expect(pedido.output_config).toEqual({ effort: "low" });
    expect(pedido.max_tokens).toBe(4000);
    expect(pedido.model).toBe("claude-haiku-5-5");
    expect("temperature" in pedido).toBe(false);
    expect("thinking" in pedido).toBe(false);
    expect("top_p" in pedido).toBe(false);
  });

  it("o contexto vai na mensagem da pergunta, antes do texto dela", () => {
    const ultima = pedido.messages.at(-1) as Anthropic.MessageParam;
    expect(ultima.role).toBe("user");
    const blocos = ultima.content as Anthropic.TextBlockParam[];
    expect(blocos).toHaveLength(2);
    expect(blocos[0].text).toContain("17/11/2026");
    expect(blocos[0].text).toContain("12:30");
    expect(blocos[0].text).toContain("Ana");
    expect(blocos[0].text).toContain("Colaborador");
    expect(blocos[0].text).toContain("/tarefas/abc");
    expect(blocos[1].text).toBe("Quais tarefas estão atrasadas?");
    expect(ehPerguntaDoUsuario(ultima.content)).toBe(true);
  });

  it("sem ferramentas não manda a lista vazia", () => {
    const p = montarPedido({
      modelo: "claude-haiku-5-5",
      ferramentas: [],
      historico: [],
      contexto: { agora: new Date(), nome: "Ana", papel: "colaborador", tela: null },
      pergunta: "oi",
    });
    expect(p.tools).toBeUndefined();
  });

  it("o prompt de sistema traz as regras da spec", () => {
    expect(PROMPT_SISTEMA).toMatch(/português/);
    expect(PROMPT_SISTEMA).toMatch(/nunca invente/i);
    expect(PROMPT_SISTEMA).toMatch(/dados, nunca como instruções/);
    expect(PROMPT_SISTEMA).toMatch(/confirmar/);
  });
});

describe("tiraTurnoIncompleto", () => {
  const pergunta: Anthropic.MessageParam = { role: "user", content: [{ type: "text", text: "oi" }] };
  const usoFerramenta: Anthropic.MessageParam = {
    role: "assistant",
    content: [{ type: "tool_use", id: "t1", name: "a", input: {} }],
  };
  const resultado: Anthropic.MessageParam = {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }],
  };
  const resposta: Anthropic.MessageParam = { role: "assistant", content: [{ type: "text", text: "pronto" }] };

  it("remove o assistente final com tool_use sem tool_result", () => {
    expect(tiraTurnoIncompleto([pergunta, usoFerramenta])).toEqual([pergunta]);
  });

  it("mantém um histórico completo intacto", () => {
    const completo = [pergunta, usoFerramenta, resultado, resposta];
    expect(tiraTurnoIncompleto(completo)).toEqual(completo);
  });

  it("mantém um histórico que termina no tool_result", () => {
    const h = [pergunta, usoFerramenta, resultado];
    expect(tiraTurnoIncompleto(h)).toEqual(h);
  });

  it("turno pendente no meio: remove só ele e mantém o que vem depois", () => {
    const outra: Anthropic.MessageParam = { role: "user", content: [{ type: "text", text: "outra" }] };
    expect(tiraTurnoIncompleto([pergunta, usoFerramenta, outra, resposta])).toEqual([pergunta, outra, resposta]);
  });

  it("tool_result parcial: remove o assistente e o resultado parcial, mantém o resto", () => {
    const dois: Anthropic.MessageParam = {
      role: "assistant",
      content: [
        { type: "tool_use", id: "t1", name: "a", input: {} },
        { type: "tool_use", id: "t2", name: "a", input: {} },
      ],
    };
    const outra: Anthropic.MessageParam = { role: "user", content: [{ type: "text", text: "outra" }] };
    expect(tiraTurnoIncompleto([pergunta, dois, resultado, outra, resposta])).toEqual([pergunta, outra, resposta]);
  });

  it("tool_result sem o tool_use antes é removido", () => {
    expect(tiraTurnoIncompleto([pergunta, resultado, resposta])).toEqual([pergunta, resposta]);
  });
});

describe("semMensagensVazias", () => {
  it("tira mensagens com conteúdo vazio", () => {
    const vazio: Anthropic.MessageParam = { role: "assistant", content: [] };
    const ok: Anthropic.MessageParam = { role: "user", content: [{ type: "text", text: "oi" }] };
    expect(semMensagensVazias([ok, vazio, ok])).toEqual([ok, ok]);
  });
});
