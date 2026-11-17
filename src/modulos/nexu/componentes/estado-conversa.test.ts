import { describe, expect, it } from "vitest";
import type { PropostaVisivel } from "../tipos";
import { aplicarEvento, estadoInicial, iniciarPergunta, lerEventosSse } from "./estado-conversa";

const base = () => iniciarPergunta(estadoInicial(), "Quantas turmas?", "u1", "a1");

const proposta = (extra: Partial<PropostaVisivel> = {}): PropostaVisivel => ({
  id: "p1",
  tipo: "criar_tarefa",
  resumo: "Criar tarefa",
  status: "pendente",
  erro: null,
  resultadoUrl: null,
  ...extra,
});

describe("aplicarEvento", () => {
  it("concatena os trechos de texto na resposta atual", () => {
    let e = base();
    e = aplicarEvento(e, { tipo: "texto", texto: "Olá, " });
    e = aplicarEvento(e, { tipo: "texto", texto: "tudo bem?" });
    expect(e.mensagens).toHaveLength(2);
    expect(e.mensagens[1]).toMatchObject({ papel: "assistente", texto: "Olá, tudo bem?" });
  });

  it("guarda o id da conversa mesmo chegando depois do texto", () => {
    let e = aplicarEvento(base(), { tipo: "texto", texto: "Oi" });
    e = aplicarEvento(e, { tipo: "conversa", conversaId: "c1" });
    expect(e.conversaId).toBe("c1");
    expect(e.mensagens[1].texto).toBe("Oi");
  });

  it("mostra o rótulo ao consultar e limpa quando o texto volta", () => {
    let e = aplicarEvento(base(), { tipo: "consultando", rotulo: "Consultando turmas…" });
    expect(e.consultando).toBe("Consultando turmas…");
    e = aplicarEvento(e, { tipo: "texto", texto: "x" });
    expect(e.consultando).toBeNull();
  });

  it("limpa o rótulo no fim e atualiza as perguntas restantes", () => {
    let e = aplicarEvento(base(), { tipo: "consultando", rotulo: "Consultando…" });
    e = aplicarEvento(e, { tipo: "fim", restantesHoje: 37 });
    expect(e).toMatchObject({ consultando: null, enviando: false, restantesHoje: 37 });
  });

  it("mostra o erro e para de enviar", () => {
    const e = aplicarEvento(base(), { tipo: "erro", mensagem: "Indisponível" });
    expect(e).toMatchObject({ erro: "Indisponível", enviando: false, consultando: null });
  });

  it("guarda propostas e atualiza pela id", () => {
    let e = aplicarEvento(base(), { tipo: "proposta", proposta: proposta() });
    e = aplicarEvento(e, { tipo: "proposta", proposta: proposta({ id: "p2" }) });
    e = aplicarEvento(e, { tipo: "proposta", proposta: proposta({ status: "confirmada" }) });
    expect(e.propostas).toHaveLength(2);
    expect(e.propostas.find((p) => p.id === "p1")?.status).toBe("confirmada");
  });
});

describe("lerEventosSse", () => {
  it("separa eventos completos e devolve o resto incompleto", () => {
    const { eventos, resto } = lerEventosSse('data: {"tipo":"texto","texto":"a"}\n\ndata: {"tipo":"fim","restan');
    expect(eventos).toEqual([{ tipo: "texto", texto: "a" }]);
    expect(resto).toBe('data: {"tipo":"fim","restan');
  });
});
