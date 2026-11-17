import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { UsuarioAtual } from "@/lib/sessao";

// Banco em memória: só o que conversas.ts usa.
const banco = vi.hoisted(() => {
  type Conversa = { id: string; usuarioId: string; titulo: string; atualizadoEm: Date };
  type Mensagem = { id: string; conversaId: string; papel: string; conteudo: unknown; ordem: number };
  const estado = { conversas: [] as Conversa[], mensagens: [] as Mensagem[], seq: 0 };
  const doConversa = (conversaId: string) => estado.mensagens.filter((m) => m.conversaId === conversaId).sort((a, b) => a.ordem - b.ordem);
  const prisma = {
    conversaNexu: {
      create: async ({ data }: { data: Omit<Conversa, "id" | "atualizadoEm"> }) => {
        const c = { id: `c${++estado.seq}`, atualizadoEm: new Date(), ...data };
        estado.conversas.push(c);
        return c;
      },
      findFirst: async ({ where }: { where: { id: string; usuarioId: string } }) => {
        const c = estado.conversas.find((x) => x.id === where.id && x.usuarioId === where.usuarioId);
        return c ? { ...c, mensagens: doConversa(c.id) } : null;
      },
      update: async ({ where }: { where: { id: string } }) => estado.conversas.find((x) => x.id === where.id),
    },
    mensagemNexu: {
      aggregate: async ({ where }: { where: { conversaId: string } }) => {
        const ms = doConversa(where.conversaId);
        return { _max: { ordem: ms.length ? Math.max(...ms.map((m) => m.ordem)) : null } };
      },
      createMany: async ({ data }: { data: Omit<Mensagem, "id">[] }) => {
        for (const d of data) estado.mensagens.push({ id: `m${++estado.seq}`, ...d });
        return { count: data.length };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma };
});

const ia = vi.hoisted(() => ({
  registrarUsoIa: vi.fn(),
  situacaoLimites: vi.fn(),
  executarA: vi.fn(),
  executarB: vi.fn(),
  executarP: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/ia/cliente", () => ({ obterClienteAnthropic: () => null }));
vi.mock("@/lib/ia/uso", () => ({ registrarUsoIa: ia.registrarUsoIa, situacaoLimites: ia.situacaoLimites }));
vi.mock("@/lib/ia/configuracao", () => ({
  obterConfiguracaoIa: async () => ({ modelo: "claude-haiku-5-5", limiteMensalMicroUsd: 20_000_000, perguntasPorDia: 50 }),
}));
vi.mock("../ferramentas/registro", () => {
  const ferramenta = (nome: string, executar: unknown, tipo = "consulta") => ({
    nome,
    descricao: nome,
    entrada: z.object({ n: z.number() }),
    permissao: "nexu:usar",
    rotulo: `Consultando ${nome}…`,
    tipo,
    executar,
  });
  const lista = [
    ferramenta("ferramenta_a", ia.executarA),
    ferramenta("ferramenta_b", ia.executarB),
    ferramenta("ferramenta_p", ia.executarP, "proposta"),
  ];
  return {
    TODAS_FERRAMENTAS: lista,
    ferramentasDoPapel: () => lista,
    paraFerramentaApi: (f: { nome: string }) => ({ name: f.nome, description: f.nome, input_schema: { type: "object" } }),
  };
});

const { executarPergunta } = await import("./executar-pergunta");
const { ErroPermissao } = await import("@/lib/permissoes");

const ator = { id: "u1", nome: "Ana", papel: "colaborador" } as UsuarioAtual;
const usage = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

type Resposta = { content: unknown[]; stop_reason: string; cortarDepoisDoInicio?: boolean; transformacoes?: unknown[] } | Error;

function resposta(content: unknown[], stop_reason = "end_turn"): Resposta {
  return { content, stop_reason };
}
const texto = (t: string) => ({ type: "text", text: t, citations: null });
const usoDe = (id: string, name = "ferramenta_a", input: unknown = { n: 1 }) => ({ type: "tool_use", id, name, input });

/**
 * Cliente falso: cada chamada a beta.messages.stream consome a próxima resposta do roteiro. Emite message_start
 * (uso de entrada), os textos e message_delta (uso de saída). Respeita o sinal: se ele disparar, lança APIUserAbortError.
 */
function clienteFalso(roteiro: Resposta[]) {
  const pedidos: (Anthropic.Beta.Messages.MessageCreateParamsNonStreaming & { messages: Anthropic.MessageParam[] })[] = [];
  const cliente = {
    beta: {
      messages: {
        stream: (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, opcoes?: { signal?: AbortSignal }) => {
          pedidos.push(structuredClone(params) as (typeof pedidos)[number]);
          expect(opcoes?.signal).toBeInstanceOf(AbortSignal);
          const sinal = opcoes!.signal!;
          const r = roteiro.shift();
          if (!r) throw new Error("roteiro acabou");
          const textos = r instanceof Error ? [] : r.content.filter((b) => (b as { type: string }).type === "text");
          const conferir = () => {
            if (sinal.aborted) throw new Anthropic.APIUserAbortError();
          };
          return {
            async *[Symbol.asyncIterator]() {
              if (r instanceof Error) throw r;
              yield {
                type: "message_start",
                message: {
                  usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
                  input_transformations: r.transformacoes ?? [],
                },
              };
              if (r.cortarDepoisDoInicio) throw new Anthropic.APIUserAbortError();
              for (const b of textos) {
                conferir();
                yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: (b as { text: string }).text } };
              }
              conferir();
              yield { type: "message_delta", delta: { stop_reason: r.stop_reason }, usage: { output_tokens: 5, input_tokens: null } };
            },
            finalMessage: async () => {
              if (r instanceof Error) throw r;
              conferir();
              return {
                id: "msg",
                type: "message",
                role: "assistant",
                model: "claude-haiku-5-5",
                content: r.content,
                stop_reason: r.stop_reason,
                usage,
              };
            },
          };
        },
      },
    },
  };
  return { cliente: cliente as unknown as Anthropic, pedidos };
}

async function coletar(gerador: AsyncGenerator<unknown>) {
  const eventos: { tipo: string; [k: string]: unknown }[] = [];
  for await (const e of gerador) eventos.push(e as { tipo: string });
  return eventos;
}

const rodar = (cliente: Anthropic, extra: Partial<Parameters<typeof executarPergunta>[0]> = {}) =>
  coletar(executarPergunta({ ator, conversaId: null, pergunta: "Quais tarefas?", tela: "/tarefas", cliente, ...extra }));

beforeEach(() => {
  banco.estado.conversas = [];
  banco.estado.mensagens = [];
  banco.estado.seq = 0;
  ia.registrarUsoIa.mockReset().mockResolvedValue(10);
  ia.situacaoLimites.mockReset().mockResolvedValue({ ok: true, restantesHoje: 49 });
  ia.executarA.mockReset().mockResolvedValue({ itens: [], total: 0 });
  ia.executarB.mockReset().mockResolvedValue({ itens: [1], total: 1 });
});

describe("executarPergunta", () => {
  it("(a) resposta direta: textos e fim, 1 UsoIa com inicioPergunta", async () => {
    const { cliente } = clienteFalso([resposta([texto("Olá"), texto(" mundo")])]);
    ia.situacaoLimites.mockResolvedValueOnce({ ok: true, restantesHoje: 49 }).mockResolvedValueOnce({ ok: true, restantesHoje: 48 });
    const eventos = await rodar(cliente);
    expect(eventos.map((e) => e.tipo)).toEqual(["texto", "texto", "conversa", "fim"]);
    expect(eventos.at(-1)).toEqual({ tipo: "fim", restantesHoje: 48 });
    expect(ia.registrarUsoIa).toHaveBeenCalledTimes(1);
    expect(ia.registrarUsoIa.mock.calls[0][0]).toMatchObject({
      origem: "nexu",
      usuarioId: "u1",
      inicioPergunta: true,
      modelo: "claude-haiku-5-5",
    });
    // Conversa criada com a pergunta como título e mensagens gravadas em ordem.
    expect(banco.estado.conversas[0]).toMatchObject({ usuarioId: "u1", titulo: "Quais tarefas?" });
    expect(banco.estado.mensagens.map((m) => [m.papel, m.ordem])).toEqual([
      ["usuario", 1],
      ["assistente", 2],
    ]);
    expect(banco.estado.mensagens[1].conteudo).toEqual([texto("Olá"), texto(" mundo")]);
  });

  it("(b) 2 tool_use na mesma resposta: as duas rodam e o user seguinte tem 2 tool_result", async () => {
    const pensamento = { type: "thinking", thinking: "vou olhar", signature: "sig" };
    const { cliente, pedidos } = clienteFalso([
      resposta([pensamento, usoDe("t1", "ferramenta_a"), usoDe("t2", "ferramenta_b")], "tool_use"),
      resposta([texto("Achei.")]),
    ]);
    const eventos = await rodar(cliente);
    expect(ia.executarA).toHaveBeenCalledWith(ator, { n: 1 }, { conversaId: "c1", toolUseId: "t1" });
    expect(ia.executarB).toHaveBeenCalledWith(ator, { n: 1 }, { conversaId: "c1", toolUseId: "t2" });
    expect(eventos.filter((e) => e.tipo === "consultando").map((e) => e.rotulo)).toEqual([
      "Consultando ferramenta_a…",
      "Consultando ferramenta_b…",
    ]);
    const segundo = pedidos[1].messages;
    const resultados = segundo.at(-1)?.content as Anthropic.ToolResultBlockParam[];
    expect(segundo.at(-1)?.role).toBe("user");
    expect(resultados.map((r) => [r.type, r.tool_use_id, r.is_error ?? false])).toEqual([
      ["tool_result", "t1", false],
      ["tool_result", "t2", false],
    ]);
    expect(JSON.parse(resultados[1].content as string)).toEqual({ itens: [1], total: 1 });
    // O assistente é gravado inteiro (com thinking) e o histórico reenviado não muda.
    expect(segundo.at(-2)?.content).toEqual([pensamento, usoDe("t1", "ferramenta_a"), usoDe("t2", "ferramenta_b")]);
    expect(banco.estado.mensagens.map((m) => m.papel)).toEqual(["usuario", "assistente", "usuario", "assistente"]);
    expect(banco.estado.mensagens[1].conteudo).toEqual(segundo.at(-2)?.content);
    expect(ia.registrarUsoIa.mock.calls.map((c) => c[0].inicioPergunta)).toEqual([true, false]);
  });

  it("(c) 9 tool_use seguidos: o 9º recebe is_error e há exatamente 1 chamada extra", async () => {
    const roteiro = Array.from({ length: 9 }, (_, i) => resposta([usoDe(`t${i + 1}`)], "tool_use"));
    const { cliente, pedidos } = clienteFalso([...roteiro, resposta([texto("Resumo final.")])]);
    const eventos = await rodar(cliente);
    expect(ia.executarA).toHaveBeenCalledTimes(8);
    expect(pedidos).toHaveLength(10);
    const ultimo = pedidos[9].messages.at(-1)?.content as Anthropic.ToolResultBlockParam[];
    expect(ultimo).toEqual([
      {
        type: "tool_result",
        tool_use_id: "t9",
        is_error: true,
        content: "limite de consultas desta pergunta atingido; responda com o que já tem",
      },
    ]);
    expect(eventos.at(-1)?.tipo).toBe("fim");
  });

  it("(c2) se a chamada extra ainda pedir ferramenta, para sem outra chamada", async () => {
    const roteiro = Array.from({ length: 10 }, (_, i) => resposta([usoDe(`t${i + 1}`)], "tool_use"));
    const { cliente, pedidos } = clienteFalso(roteiro);
    const eventos = await rodar(cliente);
    expect(pedidos).toHaveLength(10);
    expect(eventos.slice(-2)).toEqual([
      { tipo: "texto", texto: "Não consegui terminar a consulta. Tente uma pergunta mais específica." },
      { tipo: "fim", restantesHoje: 49 },
    ]);
    // O último tool_use foi gravado junto com o tool_result de erro: nada pendente no banco.
    const { tiraTurnoIncompleto } = await import("./prompt");
    const gravadas = banco.estado.mensagens.map((m) => ({ role: m.papel === "usuario" ? "user" : "assistant", content: m.conteudo }));
    expect(tiraTurnoIncompleto(gravadas as Anthropic.MessageParam[])).toHaveLength(gravadas.length);
  });

  it("(d) APIError 529 na 1ª chamada: erro, nenhum UsoIa, nada gravado", async () => {
    const erro = new Anthropic.APIError(529, { type: "overloaded_error" }, "Overloaded", new Headers());
    const { cliente } = clienteFalso([erro]);
    const eventos = await rodar(cliente);
    expect(eventos).toEqual([{ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." }]);
    expect(ia.registrarUsoIa).not.toHaveBeenCalled();
    expect(banco.estado.mensagens).toEqual([]);
    expect(banco.estado.conversas).toEqual([]);
  });

  it("(d2) erro de conexão depois de uma ferramenta: erro, e o que veio antes fica gravado", async () => {
    const { cliente } = clienteFalso([resposta([usoDe("t1")], "tool_use"), new Anthropic.APIConnectionError({})]);
    const eventos = await rodar(cliente);
    expect(eventos.at(-1)).toEqual({ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." });
    expect(ia.registrarUsoIa).toHaveBeenCalledTimes(1);
    expect(banco.estado.mensagens.map((m) => m.papel)).toEqual(["usuario", "assistente", "usuario"]);
  });

  it("(e) stop_reason refusal: texto fixo de recusa", async () => {
    const { cliente } = clienteFalso([resposta([], "refusal")]);
    const eventos = await rodar(cliente);
    expect(eventos.filter((e) => e.tipo === "texto").map((e) => e.texto)).toEqual(["Não consegui responder a isso. Tente reformular."]);
    expect(eventos.at(-1)?.tipo).toBe("fim");
  });

  it("max_tokens: acrescenta a nota de resposta cortada", async () => {
    const { cliente } = clienteFalso([resposta([texto("Parte")], "max_tokens")]);
    const eventos = await rodar(cliente);
    expect(eventos.filter((e) => e.tipo === "texto").map((e) => e.texto)).toEqual(["Parte", "\n\n_(resposta cortada)_"]);
  });

  it("(f) ferramenta lança ErroPermissao: tool_result com is_error 'sem permissão para isso'", async () => {
    ia.executarA.mockRejectedValue(new ErroPermissao("tarefas:usar"));
    const { cliente, pedidos } = clienteFalso([resposta([usoDe("t1")], "tool_use"), resposta([texto("Sem acesso.")])]);
    await rodar(cliente);
    expect(pedidos[1].messages.at(-1)?.content).toEqual([
      { type: "tool_result", tool_use_id: "t1", is_error: true, content: "sem permissão para isso" },
    ]);
  });

  it("ferramenta de proposta: o modelo recebe só id e situação, e a tela recebe o evento proposta", async () => {
    const proposta = { id: "p1", tipo: "criar_tarefa", resumo: "Criar tarefa: X", status: "pendente", erro: null, resultadoUrl: null };
    ia.executarP.mockResolvedValue({ proposta });
    const { cliente, pedidos } = clienteFalso([resposta([usoDe("t1", "ferramenta_p")], "tool_use"), resposta([texto("Confirme.")])]);
    const eventos = await rodar(cliente);
    expect(pedidos[1].messages.at(-1)?.content).toEqual([
      { type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ proposta: "p1", situacao: "aguardando confirmação da pessoa" }) },
    ]);
    expect(eventos.filter((e) => e.tipo === "proposta")).toEqual([{ tipo: "proposta", proposta }]);
  });

  it("ferramenta de proposta com erro: is_error e nenhum evento proposta", async () => {
    const { ErroNegocio } = await import("@/lib/erros");
    ia.executarP.mockRejectedValue(new ErroNegocio("Responsável inválido."));
    const { cliente, pedidos } = clienteFalso([resposta([usoDe("t1", "ferramenta_p")], "tool_use"), resposta([texto("Ops.")])]);
    const eventos = await rodar(cliente);
    expect(pedidos[1].messages.at(-1)?.content).toEqual([
      { type: "tool_result", tool_use_id: "t1", is_error: true, content: "Responsável inválido." },
    ]);
    expect(eventos.some((e) => e.tipo === "proposta")).toBe(false);
  });

  it("entrada inválida e ferramenta desconhecida viram is_error sem executar", async () => {
    const { cliente, pedidos } = clienteFalso([
      resposta([usoDe("t1", "ferramenta_a", { n: "x" }), usoDe("t2", "nao_existe")], "tool_use"),
      resposta([texto("ok")]),
    ]);
    await rodar(cliente);
    expect(ia.executarA).not.toHaveBeenCalled();
    const resultados = pedidos[1].messages.at(-1)?.content as Anthropic.ToolResultBlockParam[];
    expect(resultados.map((r) => r.is_error)).toEqual([true, true]);
    expect(resultados[0].content).toMatch(/^entrada inválida/);
  });

  it("(g) limite do dia: texto fixo, sem chamar o cliente", async () => {
    ia.situacaoLimites.mockResolvedValue({ ok: false, motivo: "dia" });
    const stream = vi.fn();
    const eventos = await rodar({ beta: { messages: { stream } } } as unknown as Anthropic);
    expect(stream).not.toHaveBeenCalled();
    expect(eventos[0]).toEqual({ tipo: "texto", texto: "O limite de perguntas de hoje acabou. Volta amanhã." });
  });

  it("limite do mês: texto fixo do mês", async () => {
    ia.situacaoLimites.mockResolvedValue({ ok: false, motivo: "mes" });
    const eventos = await rodar({ beta: { messages: { stream: vi.fn() } } } as unknown as Anthropic);
    expect(eventos[0]).toEqual({ tipo: "texto", texto: "O limite do mês foi atingido. Fale com o admin." });
  });

  it("sem cliente: erro 'Nexu ainda não configurado'", async () => {
    const eventos = await coletar(executarPergunta({ ator, conversaId: null, pergunta: "oi", tela: null }));
    expect(eventos).toEqual([{ tipo: "erro", mensagem: "Nexu ainda não configurado" }]);
  });

  it("conversa com 30 perguntas: pede uma conversa nova sem chamar o cliente", async () => {
    banco.estado.conversas.push({ id: "cx", usuarioId: "u1", titulo: "t", atualizadoEm: new Date() });
    const { montarPedido } = await import("./prompt");
    const msg = montarPedido({
      modelo: "claude-haiku-5-5",
      ferramentas: [],
      historico: [],
      contexto: { agora: new Date(), nome: "Ana", papel: "colaborador", tela: null },
      pergunta: "p",
    }).messages[0];
    for (let i = 0; i < 30; i++) {
      banco.estado.mensagens.push({ id: `q${i}`, conversaId: "cx", papel: "usuario", conteudo: msg.content, ordem: i * 2 + 1 });
      banco.estado.mensagens.push({ id: `r${i}`, conversaId: "cx", papel: "assistente", conteudo: [texto("r")], ordem: i * 2 + 2 });
    }
    const stream = vi.fn();
    const eventos = await rodar({ beta: { messages: { stream } } } as unknown as Anthropic, { conversaId: "cx" });
    expect(stream).not.toHaveBeenCalled();
    expect(eventos[0]).toEqual({ tipo: "texto", texto: "Esta conversa ficou longa. Comece uma nova conversa para continuar." });
  });

  it("conversa existente: reenvia o histórico sem o turno incompleto e continua a ordem", async () => {
    banco.estado.conversas.push({ id: "cx", usuarioId: "u1", titulo: "t", atualizadoEm: new Date() });
    banco.estado.mensagens.push(
      { id: "a", conversaId: "cx", papel: "usuario", conteudo: [{ type: "text", text: "antes" }], ordem: 1 },
      { id: "b", conversaId: "cx", papel: "assistente", conteudo: [usoDe("tz")], ordem: 2 },
    );
    const { cliente, pedidos } = clienteFalso([resposta([texto("ok")])]);
    const eventos = await rodar(cliente, { conversaId: "cx" });
    expect(eventos.some((e) => e.tipo === "conversa")).toBe(false);
    expect(pedidos[0].messages).toHaveLength(2);
    expect(pedidos[0].messages[0].content).toEqual([{ type: "text", text: "antes" }]);
    expect(banco.estado.mensagens.filter((m) => m.conversaId === "cx").map((m) => m.ordem)).toEqual([1, 2, 3, 4]);
  });

  it("conversa de outra pessoa: erro 'Não encontrado.'", async () => {
    banco.estado.conversas.push({ id: "cy", usuarioId: "u2", titulo: "t", atualizadoEm: new Date() });
    const { cliente, pedidos } = clienteFalso([resposta([texto("ok")])]);
    const eventos = await rodar(cliente, { conversaId: "cy" });
    expect(eventos).toEqual([{ tipo: "erro", mensagem: "Não encontrado." }]);
    expect(pedidos).toHaveLength(0);
  });

  it("timeout (APIUserAbortError) na 1ª chamada: erro indisponível e nada gravado", async () => {
    const { cliente } = clienteFalso([new Anthropic.APIUserAbortError()]);
    const eventos = await rodar(cliente);
    expect(eventos).toEqual([{ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." }]);
    expect(banco.estado.mensagens).toEqual([]);
  });

  it("timeout depois de uma ferramenta: o que ficou gravado está completo (sem tool_use pendente)", async () => {
    const { cliente } = clienteFalso([resposta([usoDe("t1")], "tool_use"), new Anthropic.APIUserAbortError()]);
    const eventos = await rodar(cliente);
    expect(eventos.at(-1)).toEqual({ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." });
    expect(banco.estado.mensagens.map((m) => m.papel)).toEqual(["usuario", "assistente", "usuario"]);
    expect((banco.estado.mensagens[2].conteudo as { tool_use_id: string }[])[0].tool_use_id).toBe("t1");
  });

  it("tela fecha durante 'consultando': nenhum tool_use fica gravado sem resposta", async () => {
    const { cliente } = clienteFalso([resposta([usoDe("t1")], "tool_use"), resposta([texto("ok")])]);
    const gerador = executarPergunta({ ator, conversaId: null, pergunta: "Quais tarefas?", tela: null, cliente });
    for (;;) {
      const { value, done } = await gerador.next();
      if (done || value.tipo === "consultando") break;
    }
    await gerador.return(undefined);
    expect(banco.estado.mensagens).toEqual([]);
  });

  it("2ª pergunta depois de uma recusa vazia: nenhum assistente vazio é reenviado", async () => {
    const primeiro = clienteFalso([resposta([], "refusal")]);
    await rodar(primeiro.cliente);
    expect(banco.estado.mensagens.map((m) => m.papel)).toEqual(["usuario"]);
    const conversaId = banco.estado.conversas[0].id;
    const segundo = clienteFalso([resposta([texto("ok")])]);
    await rodar(segundo.cliente, { conversaId, pergunta: "Outra coisa" });
    const enviadas = segundo.pedidos[0].messages;
    expect(enviadas.every((m) => Array.isArray(m.content) && m.content.length > 0)).toBe(true);
    expect(enviadas.map((m) => m.role)).toEqual(["user", "user"]);
  });

  it("histórico com turno pendente no meio: só ele sai, o resto é reenviado", async () => {
    banco.estado.conversas.push({ id: "cz", usuarioId: "u1", titulo: "t", atualizadoEm: new Date() });
    const q1 = [{ type: "text", text: "q1" }];
    const q2 = [{ type: "text", text: "q2" }];
    banco.estado.mensagens.push(
      { id: "1", conversaId: "cz", papel: "usuario", conteudo: q1, ordem: 1 },
      { id: "2", conversaId: "cz", papel: "assistente", conteudo: [usoDe("tp")], ordem: 2 },
      { id: "3", conversaId: "cz", papel: "usuario", conteudo: q2, ordem: 3 },
      { id: "4", conversaId: "cz", papel: "assistente", conteudo: [texto("r2")], ordem: 4 },
    );
    const { cliente, pedidos } = clienteFalso([resposta([texto("ok")])]);
    await rodar(cliente, { conversaId: "cz" });
    expect(pedidos[0].messages.slice(0, 3).map((m) => m.content)).toEqual([q1, q2, [texto("r2")]]);
    expect(pedidos[0].messages).toHaveLength(4);
  });

  describe("uso registrado mesmo quando a chamada é cortada", () => {
    it("corte depois do message_start na 1ª chamada: 1 UsoIa (inicioPergunta) e nada gravado", async () => {
      const { cliente } = clienteFalso([{ content: [texto("x")], stop_reason: "end_turn", cortarDepoisDoInicio: true }]);
      const eventos = await rodar(cliente);
      expect(eventos).toEqual([{ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." }]);
      expect(ia.registrarUsoIa).toHaveBeenCalledTimes(1);
      expect(ia.registrarUsoIa.mock.calls[0][0]).toMatchObject({ inicioPergunta: true, usage: { input_tokens: 10, output_tokens: 1 } });
      expect(banco.estado.mensagens).toEqual([]);
    });

    it("a tela desiste no meio do texto (gerador encerrado): o uso parcial é registrado uma vez", async () => {
      const { cliente } = clienteFalso([resposta([texto("a"), texto("b")])]);
      const gerador = executarPergunta({ ator, conversaId: null, pergunta: "Quais tarefas?", tela: null, cliente });
      const primeiro = await gerador.next();
      expect(primeiro.value).toEqual({ tipo: "texto", texto: "a" });
      await gerador.return(undefined);
      expect(ia.registrarUsoIa).toHaveBeenCalledTimes(1);
      expect(ia.registrarUsoIa.mock.calls[0][0]).toMatchObject({ inicioPergunta: true });
    });

    it("o sinal da requisição dispara no meio: corta a chamada, registra o uso e não chama de novo", async () => {
      const sinal = new AbortController();
      const { cliente, pedidos } = clienteFalso([resposta([texto("a"), texto("b")]), resposta([texto("nunca")])]);
      const gerador = executarPergunta({ ator, conversaId: null, pergunta: "Quais tarefas?", tela: null, cliente, sinal: sinal.signal });
      await gerador.next();
      sinal.abort();
      const resto: unknown[] = [];
      for await (const ev of gerador) resto.push(ev);
      expect(resto).toEqual([{ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." }]);
      expect(pedidos).toHaveLength(1);
      expect(ia.registrarUsoIa).toHaveBeenCalledTimes(1);
    });

    it("caminho normal com ferramenta: um UsoIa por chamada, com o usage final", async () => {
      const { cliente } = clienteFalso([resposta([usoDe("t1")], "tool_use"), resposta([texto("ok")])]);
      await rodar(cliente);
      expect(ia.registrarUsoIa).toHaveBeenCalledTimes(2);
      expect(ia.registrarUsoIa.mock.calls.map((c) => c[0].usage)).toEqual([usage, usage]);
    });

    it("falha ao gravar o uso não esconde a resposta", async () => {
      ia.registrarUsoIa.mockRejectedValueOnce(new Error("banco fora"));
      const { cliente } = clienteFalso([resposta([texto("ok")])]);
      const eventos = await rodar(cliente);
      expect(eventos.map((e) => e.tipo)).toEqual(["texto", "conversa", "fim"]);
    });
  });

  it("texto de rodadas diferentes e avisos vêm separados por linha em branco", async () => {
    const { cliente } = clienteFalso([resposta([texto("Vou ver."), usoDe("t1")], "tool_use"), resposta([texto("Achei 2.")])]);
    const eventos = await rodar(cliente);
    expect(eventos.filter((e) => e.tipo === "texto").map((e) => e.texto)).toEqual(["Vou ver.", "\n\nAchei 2."]);

    const recusa = clienteFalso([resposta([texto("Olhei."), usoDe("t2")], "tool_use"), resposta([], "refusal")]);
    const eventos2 = await rodar(recusa.cliente);
    expect(eventos2.filter((e) => e.tipo === "texto").map((e) => e.texto)).toEqual([
      "Olhei.",
      "\n\nNão consegui responder a isso. Tente reformular.",
    ]);
  });

  it("pedido vai pelo beta com thinking adaptativo e drop_block", async () => {
    const { cliente, pedidos } = clienteFalso([resposta([texto("ok")])]);
    await rodar(cliente);
    expect(pedidos[0].thinking).toEqual({ type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } });
    expect(pedidos[0].betas).toEqual(["thinking-binding-controls-2026-08-01"]);
  });

  it("blocos de thinking descartados: loga só a contagem e os motivos", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transformacoes = [
      { type: "thinking_dropped", path: "messages.1.content.0", reason: "prefix_binding_mismatch" },
      { type: "thinking_dropped", path: "messages.3.content.0", reason: "prefix_binding_mismatch" },
    ];
    const { cliente } = clienteFalso([{ ...(resposta([texto("ok")]) as object), transformacoes } as Resposta]);
    await rodar(cliente);
    expect(aviso).toHaveBeenCalledWith("[nexu] blocos de thinking descartados", {
      conversaId: null,
      quantidade: 2,
      motivos: ["prefix_binding_mismatch"],
    });
    aviso.mockRestore();
  });
});
