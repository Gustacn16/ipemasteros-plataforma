import { describe, expect, it } from "vitest";
import { mensagensParaTela } from "./historico";

describe("mensagensParaTela", () => {
  it("mostra só a pergunta, só blocos de texto e esconde tool_result", () => {
    const r = mensagensParaTela([
      {
        id: "1",
        papel: "usuario",
        conteudo: [
          { type: "text", text: "<contexto>\nsegredo\n</contexto>" },
          { type: "text", text: "Quantas turmas?" },
        ],
      },
      {
        id: "2",
        papel: "assistente",
        conteudo: [
          { type: "thinking", thinking: "x" },
          { type: "tool_use", id: "t", name: "n", input: {} },
        ],
      },
      { id: "3", papel: "usuario", conteudo: [{ type: "tool_result", tool_use_id: "t", content: "dados" }] },
      { id: "4", papel: "assistente", conteudo: [{ type: "text", text: "Há 3 turmas." }] },
    ]);
    expect(r).toEqual([
      { id: "1", papel: "usuario", texto: "Quantas turmas?" },
      { id: "4", papel: "assistente", texto: "Há 3 turmas." },
    ]);
  });

  it("põe o cartão na mensagem do tool_use e esconde os avisos internos", () => {
    const proposta = {
      id: "p1",
      toolUseId: "tu1",
      tipo: "criar_tarefa" as const,
      resumo: "Criar tarefa",
      status: "confirmada" as const,
      erro: null,
      resultadoUrl: "/tarefas/t1",
    };
    const r = mensagensParaTela(
      [
        {
          id: "1",
          papel: "usuario",
          conteudo: [
            { type: "text", text: "<contexto>\nx\n</contexto>" },
            { type: "text", text: "Crie uma tarefa" },
          ],
        },
        { id: "2", papel: "assistente", conteudo: [{ type: "tool_use", id: "tu1", name: "propor_criar_tarefa", input: {} }] },
        { id: "3", papel: "usuario", conteudo: [{ type: "tool_result", tool_use_id: "tu1", content: "ok" }] },
        { id: "4", papel: "usuario", conteudo: "[Confirmei a proposta: Criar tarefa]" },
        { id: "5", papel: "usuario", conteudo: "[Recusei a proposta: Criar tarefa]" },
        { id: "6", papel: "usuario", conteudo: "[A proposta falhou: erro]" },
      ],
      [proposta],
    );
    expect(r).toEqual([
      { id: "1", papel: "usuario", texto: "Crie uma tarefa" },
      {
        id: "2",
        papel: "assistente",
        texto: "",
        propostas: [
          { id: "p1", tipo: "criar_tarefa", resumo: "Criar tarefa", status: "confirmada", erro: null, resultadoUrl: "/tarefas/t1" },
        ],
      },
    ]);
  });
});
