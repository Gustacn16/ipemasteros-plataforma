import { describe, expect, it } from "vitest";
import { lerAbas, lerDia } from "./ler";

const CABECALHO = ["ID", "Nome", "CURSO", "CRM ", "Formação", "Turma", "Telefone", "Data de Início", "Data de Formatura", "Vigência", "OBS", "Plano da pós-graduação"];

describe("lerAbas", () => {
  it("lê só abas com Nome, Curso e Turma", () => {
    const r = lerAbas([
      { nome: "Alunos", linhas: [CABECALHO, ["001", "Pessoa Um", "PÓS - TC&T", 28117, "Ativo ", "4° turma", 6299990000, new Date("2024-03-01T00:00:00Z"), "01/03/2025", "1 ano", "obs", "Plano X"]] },
      { nome: "Estoque", linhas: [["Item", "Quantidade"], ["Luva", 3]] },
    ]);
    expect(r.abasLidas).toEqual(["Alunos"]);
    expect(r.abasIgnoradas).toEqual(["Estoque"]);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({
      numero: 2,
      curso: "PÓS - TC&T",
      nomeBusca: "pessoa um",
      crm: "28117",
      telefone: "6299990000",
      turma: { nome: "4ª turma", ciclica: false },
      situacao: { situacao: "ativa", nota: null },
      dataInicio: "2024-03-01",
      dataFormatura: "2025-03-01",
      vigencia: "1 ano",
      plano: "Plano X",
      observacoes: "obs",
      erros: [],
    });
  });

  it("aceita a coluna Status no lugar de Formação", () => {
    const r = lerAbas([{ nome: "PSQ", linhas: [["Coluna 1", "Nome", "Curso", "Status", "Turma"], ["001", "Pessoa", "PÓS - PSQ EAD", "Ativo", "1ª turma"]] }]);
    expect(r.linhas[0].situacao?.situacao).toBe("ativa");
  });

  it("ignora linhas vazias no fim da aba", () => {
    const r = lerAbas([{ nome: "A", linhas: [CABECALHO, ["001", "Pessoa", "C", null, "Ativo", "1ª turma"], ["081"], [null, null, null], []] }]);
    expect(r.linhas).toHaveLength(1);
  });

  it("problemas viram erro com a linha, sem o nome do aluno", () => {
    const r = lerAbas([{ nome: "A", linhas: [CABECALHO, ["001", "Nome Secreto", "C", null, "Sumiu", "", null, "31/02/2024"]] }]);
    const erros = r.linhas[0].erros;
    expect(erros).toEqual(["Situação desconhecida: “Sumiu”.", "Turma vazia.", "Data de início inválida."]);
    expect(erros.join(" ")).not.toContain("Secreto");
  });
});

describe("lerDia", () => {
  it("aceita Date, dd/mm/aaaa e série do Excel", () => {
    expect(lerDia(new Date("2025-12-31T00:00:00Z"))).toBe("2025-12-31");
    expect(lerDia("5/1/2026")).toBe("2026-01-05");
    expect(lerDia(45658)).toBe("2025-01-01");
    expect(lerDia("")).toBeNull();
    expect(lerDia("amanhã")).toBeUndefined();
  });
});
