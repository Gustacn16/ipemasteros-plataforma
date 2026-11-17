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
});
