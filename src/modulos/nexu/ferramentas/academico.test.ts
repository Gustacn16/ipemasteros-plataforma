import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

const mocks = vi.hoisted(() => ({ turmas: vi.fn(), turma: vi.fn(), formaturas: vi.fn(), alunos: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/modulos/academico/servicos/turmas", () => ({ listarTurmas: mocks.turmas, obterTurma: mocks.turma }));
vi.mock("../servicos/consultas-academico", () => ({ formaturasDasTurmas: mocks.formaturas, buscarAlunosParaNexu: mocks.alunos }));

const { alunoMinimo, ferramentaTurmasEFormaturas, ferramentaBuscarAluno } = await import("./academico");
const { ErroNegocio } = await import("@/lib/erros");

const ator = { id: "u1", nome: "Ana", papel: "gestor" } as UsuarioAtual;
const ctx = { conversaId: "c1", toolUseId: "t1" };

const turma = (id: string, nome: string) => ({
  id,
  nome,
  ciclica: false,
  situacao: "em_andamento",
  dataInicio: "2026-01-10",
  dataFim: null,
  produto: { id: "p1", nome: "Pós" },
  ativos: 10,
});

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
});

describe("alunoMinimo", () => {
  it("não deixa passar e-mail, telefone, CRM nem observações", () => {
    const bruto = {
      id: "a1",
      nome: "Maria",
      email: "maria@exemplo.com",
      telefone: "11999998888",
      crm: "12345",
      crmUf: "SP",
      observacoes: "ligar",
      matriculas: [{ situacao: "ativa", dataInicio: new Date("2026-01-10T00:00:00Z"), dataFormatura: null, turma: { nome: "T1" } }],
    };
    const r = alunoMinimo(bruto);
    expect(Object.keys(r)).toEqual(["id", "nome", "matriculas"]);
    const json = JSON.stringify(r);
    expect(json).not.toContain("maria@exemplo.com");
    expect(json).not.toContain("11999998888");
    expect(r.matriculas[0]).toEqual({ turma: "T1", situacao: "ativa", dataInicio: "2026-01-10", dataFormatura: null });
  });
});

describe("turmas_e_formaturas", () => {
  it("formamDe/formamAte filtram a data de formatura no intervalo", async () => {
    mocks.turmas.mockResolvedValue([turma("t1", "A"), turma("t2", "B"), turma("t3", "C"), turma("t4", "D")]);
    mocks.formaturas.mockResolvedValue(
      new Map([
        ["t1", "2026-06-30"],
        ["t2", "2026-12-10"],
        ["t3", "2027-02-01"],
      ]),
    );
    const r = (await ferramentaTurmasEFormaturas.executar(ator, { formamDe: "2026-07-01", formamAte: "2027-01-31" }, ctx)) as {
      itens: { id: string }[];
    };
    expect(r.itens.map((t) => t.id)).toEqual(["t2"]);
  });

  it("rejeita datas inválidas", async () => {
    await expect(ferramentaTurmasEFormaturas.executar(ator, { formamDe: "2026-13-40" }, ctx)).rejects.toBeInstanceOf(ErroNegocio);
  });

  it("com turmaId lista alunos só com nome e matrícula", async () => {
    mocks.turmas.mockResolvedValue([turma("t1", "A")]);
    mocks.formaturas.mockResolvedValue(new Map());
    mocks.turma.mockResolvedValue({
      nome: "A",
      matriculas: [
        { situacao: "ativa", dataInicio: "2026-01-10", dataFormatura: null, observacoes: "x", aluno: { id: "a1", nome: "Maria" } },
      ],
    });
    const r = (await ferramentaTurmasEFormaturas.executar(ator, { turmaId: "t1" }, ctx)) as { alunos: { itens: unknown[] } };
    expect(r.alunos.itens[0]).toEqual({
      id: "a1",
      nome: "Maria",
      matriculas: [{ turma: "A", situacao: "ativa", dataInicio: "2026-01-10", dataFormatura: null }],
    });
  });
});

describe("buscar_aluno", () => {
  it("devolve só o formato mínimo", async () => {
    mocks.alunos.mockResolvedValue([{ id: "a1", nome: "Maria", matriculas: [] }]);
    const r = (await ferramentaBuscarAluno.executar(ator, { nome: "mari" }, ctx)) as { itens: unknown[] };
    expect(r.itens).toEqual([{ id: "a1", nome: "Maria", matriculas: [] }]);
  });
});
