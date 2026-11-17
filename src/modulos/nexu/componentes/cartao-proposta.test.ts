import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PropostaVisivel } from "../tipos";

vi.mock("../acoes/propostas", () => ({ confirmarPropostaAcao: vi.fn(), recusarPropostaAcao: vi.fn() }));

import { CartaoProposta } from "./cartao-proposta";

const proposta = (extra: Partial<PropostaVisivel> = {}): PropostaVisivel => ({
  id: "p1",
  tipo: "criar_tarefa",
  resumo: "Criar tarefa: Ligar para a turma",
  status: "pendente",
  erro: null,
  resultadoUrl: null,
  ...extra,
});
const html = (p: PropostaVisivel) => renderToStaticMarkup(createElement(CartaoProposta, { proposta: p }));

describe("CartaoProposta", () => {
  it("pendente mostra o resumo e os botões", () => {
    const h = html(proposta());
    expect(h).toContain("Criar tarefa: Ligar para a turma");
    expect(h).toContain("Confirmar");
    expect(h).toContain("Recusar");
  });
  it("executando mostra andamento sem botões", () => {
    const h = html(proposta({ status: "executando" }));
    expect(h).toContain("Em andamento…");
    expect(h).not.toContain("Confirmar");
  });
  it("confirmada mostra criada e o link", () => {
    const h = html(proposta({ status: "confirmada", resultadoUrl: "/tarefas/t1" }));
    expect(h).toContain("✓ Criada");
    expect(h).toContain('href="/tarefas/t1"');
    expect(h).not.toContain("Confirmar");
  });
  it("recusada mostra Recusada", () => {
    expect(html(proposta({ status: "recusada" }))).toContain("Recusada");
  });
  it("falhou mostra o erro", () => {
    expect(html(proposta({ status: "falhou", erro: "Turma não encontrada." }))).toContain("Turma não encontrada.");
  });
});
