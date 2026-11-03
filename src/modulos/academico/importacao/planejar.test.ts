import { describe, expect, it } from "vitest";
import type { LinhaImportada } from "./ler";
import { IGNORAR, planejarImportacao, sugerirProduto, type Existentes } from "./planejar";

let numero = 1;
const linha = (parcial: Partial<LinhaImportada> & { nome: string }): LinhaImportada => ({
  aba: "A",
  numero: ++numero,
  curso: "PÓS - TC&T",
  nomeBusca: parcial.nome.toLowerCase(),
  turma: { nome: "1ª turma", ciclica: false },
  situacao: { situacao: "ativa", nota: null },
  crm: null,
  telefone: null,
  dataInicio: null,
  dataFormatura: null,
  vigencia: null,
  plano: null,
  observacoes: null,
  erros: [],
  ...parcial,
});

const vazio: Existentes = { turmas: [], alunos: [], matriculas: [] };
const mapa = { "PÓS - TC&T": "p1" };

describe("planejarImportacao", () => {
  it("curso sem produto escolhido bloqueia, uma mensagem por curso", () => {
    const p = planejarImportacao([linha({ nome: "a", curso: "X" }), linha({ nome: "b", curso: "X" })], {}, vazio);
    expect(p.erros).toHaveLength(1);
    expect(p.erros[0].mensagem).toBe("Escolha o produto para o curso “X”.");
    expect(p.matriculas).toHaveLength(0);
  });

  it("curso ignorado não grava nem bloqueia, mesmo com erros na linha", () => {
    const p = planejarImportacao([linha({ nome: "a", curso: "CURSO LIVRE", erros: ["Turma vazia."] }), linha({ nome: "b" })], { ...mapa, "CURSO LIVRE": IGNORAR }, vazio);
    expect(p.erros).toEqual([]);
    expect(p.ignoradas).toBe(1);
    expect(p.matriculas).toHaveLength(1);
  });

  it("erro de linha não ignorada bloqueia tudo", () => {
    const p = planejarImportacao([linha({ nome: "a", erros: ["Turma vazia."] }), linha({ nome: "b" })], mapa, vazio);
    expect(p.erros).toHaveLength(1);
    expect(p.matriculas).toHaveLength(0);
  });

  it("turma nova: em andamento se há ativo, menor data de início", () => {
    const p = planejarImportacao(
      [
        linha({ nome: "a", situacao: { situacao: "concluida", nota: null }, dataInicio: "2024-05-01" }),
        linha({ nome: "b", dataInicio: "2024-02-01" }),
        linha({ nome: "c", turma: { nome: "2ª turma", ciclica: false }, situacao: { situacao: "cancelada", nota: null } }),
      ],
      mapa,
      vazio,
    );
    expect(p.turmasNovas).toEqual([
      expect.objectContaining({ nome: "1ª turma", situacao: "em_andamento", dataInicio: "2024-02-01" }),
      expect.objectContaining({ nome: "2ª turma", situacao: "concluida", dataInicio: null }),
    ]);
  });

  it("turma cíclica fica sem data de início", () => {
    const p = planejarImportacao([linha({ nome: "a", turma: { nome: "Cíclica", ciclica: true }, dataInicio: "2024-01-01" })], mapa, vazio);
    expect(p.turmasNovas[0]).toMatchObject({ ciclica: true, dataInicio: null });
  });

  it("nota de 'finalizou as práticas' vai antes da observação", () => {
    const p = planejarImportacao([linha({ nome: "a", situacao: { situacao: "ativa", nota: "Nota" }, observacoes: "Obs" })], mapa, vazio);
    expect(p.matriculas[0].dados.observacoes).toBe("Nota\nObs");
  });

  it("reimportar com tudo já gravado não cria nada novo", () => {
    const existentes: Existentes = {
      turmas: [{ id: "t1", produtoId: "p1", nome: "1ª turma" }],
      alunos: [{ id: "a1", nomeBusca: "ana", telefone: "629", crm: null }],
      matriculas: [{ id: "m1", alunoId: "a1", turmaId: "t1" }],
    };
    const p = planejarImportacao([linha({ nome: "Ana", telefone: "629", crm: "123" })], mapa, existentes);
    expect(p.turmasNovas).toEqual([]);
    expect(p.alunosNovos).toEqual([]);
    expect(p.alunosExistentes).toBe(1);
    expect(p.alunosCompletar).toEqual([{ id: "a1", crm: "123" }]);
    expect(p.matriculas).toEqual([expect.objectContaining({ id: "m1", aluno: { id: "a1" }, turma: { id: "t1" } })]);
  });

  it("homônimo com telefone diferente é outra pessoa", () => {
    const existentes: Existentes = { ...vazio, alunos: [{ id: "a1", nomeBusca: "ana", telefone: "111", crm: null }] };
    const p = planejarImportacao([linha({ nome: "Ana", telefone: "222" })], mapa, existentes);
    expect(p.alunosNovos).toHaveLength(1);
    expect(p.matriculas[0].aluno).toEqual({ chave: p.alunosNovos[0].chave });
  });

  it("mesma pessoa no mesmo produto em duas turmas: um aluno, duas matrículas", () => {
    const p = planejarImportacao([linha({ nome: "Ana" }), linha({ nome: "Ana", turma: { nome: "2ª turma", ciclica: false } })], mapa, vazio);
    expect(p.alunosNovos).toHaveLength(1);
    expect(p.matriculas).toHaveLength(2);
  });

  it("mesma pessoa e mesma turma repetidas: aviso e vale a última linha", () => {
    const p = planejarImportacao([linha({ nome: "Ana" }), linha({ nome: "Ana", situacao: { situacao: "trancada", nota: null } })], mapa, vazio);
    expect(p.matriculas).toHaveLength(1);
    expect(p.matriculas[0].dados.situacao).toBe("trancada");
    expect(p.avisos).toHaveLength(1);
  });
});

describe("sugerirProduto", () => {
  const produtos = [
    { id: "tct", nome: "Pós-Graduação Lato Sensu - Transplante Capilar e Tricologia", sku: "PG001TCT" },
    { id: "pm", nome: "Transplante Capilar", sku: "PM001TC" },
    { id: "ead", nome: "Pós-Graduação em Psiquiatria EAD", sku: null },
    { id: "hib", nome: "Pós-Graduação em Psiquiatria Híbrido", sku: null },
    { id: "blef", nome: "Curso livre de blefaroplastia Superior", sku: "CL002BLEFARO" },
  ];

  it("reconhece as siglas da planilha", () => {
    expect(sugerirProduto("PÓS - TC&T", produtos)).toBe("tct");
    expect(sugerirProduto("PÓS - PSQ EAD", produtos)).toBe("ead");
    expect(sugerirProduto("PÓS - PSQ HIBRIDO", produtos)).toBe("hib");
  });

  it("reconhece o SKU e não chuta quando é genérico", () => {
    expect(sugerirProduto("pg001tct", produtos)).toBe("tct");
    expect(sugerirProduto("CURSO LIVRE", produtos)).toBeNull();
    expect(sugerirProduto("PÓS - PSQ", produtos)).toBeNull();
  });
});
