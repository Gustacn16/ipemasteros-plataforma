import { describe, expect, it } from "vitest";
import { esquemaProposta } from "./propostas";

const venda = {
  tipo: "registrar_venda",
  produtoId: "p1",
  vendedorId: "u1",
  dataVenda: "2026-11-17",
  nomeCliente: "Fulano de Tal",
  metodoPagamento: "pix",
  entrada: "1500.00",
};

describe("esquemaProposta", () => {
  it("criar_tarefa sem título é rejeitada", () => {
    expect(esquemaProposta.safeParse({ tipo: "criar_tarefa", listaId: "l1" }).success).toBe(false);
    expect(esquemaProposta.safeParse({ tipo: "criar_tarefa", listaId: "l1", titulo: "  " }).success).toBe(false);
  });

  it("criar_tarefa completa passa", () => {
    const r = esquemaProposta.safeParse({
      tipo: "criar_tarefa",
      listaId: "l1",
      titulo: "Revisar post",
      dataEntrega: "2026-11-21",
      responsaveis: ["u2"],
      subtarefas: ["Texto", "Arte"],
    });
    expect(r.success).toBe(true);
  });

  it("criar_tarefa com data inexistente é rejeitada", () => {
    expect(esquemaProposta.safeParse({ tipo: "criar_tarefa", listaId: "l1", titulo: "X", dataEntrega: "2026-02-30" }).success).toBe(false);
  });

  it("registrar_venda ignora whatsappCliente, observações e próximos passos", () => {
    const r = esquemaProposta.parse({ ...venda, whatsappCliente: "11999998888", observacoes: "nota", proximosPassos: "ligar" });
    expect(r).toMatchObject({
      tipo: "registrar_venda",
      whatsappCliente: null,
      observacoes: null,
      proximosPassos: null,
      entrada: "1500.00",
    });
  });

  it("registrar_venda mantém as regras do esquema do módulo (valor da venda)", () => {
    expect(esquemaProposta.safeParse({ ...venda, entrada: undefined }).success).toBe(false);
  });

  it("criar_evento mantém a checagem de período", () => {
    const evento = {
      tipo: "criar_evento",
      tipoId: "t1",
      titulo: "Aula",
      visivelProfessores: true,
      dataInicio: "2026-11-20",
      dataFim: "2026-11-20",
      horaInicio: "14:00",
      horaFim: "15:00",
    };
    expect(esquemaProposta.safeParse(evento).success).toBe(true);
    expect(esquemaProposta.safeParse({ ...evento, dataFim: "2026-11-19" }).success).toBe(false);
  });

  it("um tipo desconhecido é rejeitado", () => {
    expect(esquemaProposta.safeParse({ tipo: "apagar_tudo", listaId: "l1", titulo: "X" }).success).toBe(false);
  });
});
