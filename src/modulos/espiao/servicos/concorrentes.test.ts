import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import { esquemaTeto } from "../esquemas/configuracao";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  concorrente: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  paginaConcorrente: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  configuracaoIa: { upsert: vi.fn() },
  auditar: vi.fn(),
  iniciar: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { concorrente: m.concorrente, paginaConcorrente: m.paginaConcorrente, configuracaoIa: m.configuracaoIa } }));
vi.mock("@/lib/auditoria", () => ({ registrarAuditoria: m.auditar }));
vi.mock("./coleta", () => ({ iniciarColeta: m.iniciar }));
const { coletarAgora, criarConcorrente, salvarPagina, salvarTetoEspiao } = await import("./concorrentes");

const admin = { id: "a1", papel: "admin" } as never;
const gestor = { id: "g1", papel: "gestor" } as never;
const colaborador = { id: "c1", papel: "colaborador" } as never;
const dados = { nome: "Concorrente X", instagram: "x", site: "x.com.br", observacoes: undefined, ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  m.concorrente.count.mockResolvedValue(0);
  m.concorrente.create.mockResolvedValue({ id: "k1" });
  m.paginaConcorrente.count.mockResolvedValue(0);
  m.concorrente.findFirst.mockResolvedValue({ id: "k1" });
  m.paginaConcorrente.create.mockResolvedValue({ id: "p1" });
});

describe("configuração do espião", () => {
  it("colaborador e gestor não configuram", async () => {
    await expect(criarConcorrente(colaborador, dados)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(criarConcorrente(gestor, dados)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("recusa o 11º concorrente ativo", async () => {
    m.concorrente.count.mockResolvedValue(10);
    await expect(criarConcorrente(admin, dados)).rejects.toThrow(new ErroNegocio("Limite de 10 concorrentes ativos"));
  });

  it("criar gera auditoria", async () => {
    await criarConcorrente(admin, dados);
    expect(m.auditar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "a1", acao: "espiao.concorrente_criado", entidade: "concorrente", entidadeId: "k1" }));
  });

  it("recusa a 11ª página de um concorrente", async () => {
    m.paginaConcorrente.count.mockResolvedValue(10);
    await expect(salvarPagina(admin, "k1", { url: "https://x.com/a", rotulo: "Pós A", ativa: true })).rejects.toThrow("Limite de 10 páginas por concorrente");
  });

  it("teto fora de 1 a 100 dólares é inválido", () => {
    expect(esquemaTeto.safeParse({ tetoUsd: "0" }).success).toBe(false);
    expect(esquemaTeto.safeParse({ tetoUsd: "101" }).success).toBe(false);
    expect(esquemaTeto.parse({ tetoUsd: "10,50" }).tetoUsd).toBe(10_500_000);
  });

  it("salvar teto audita e grava em micro-dólares", async () => {
    await salvarTetoEspiao(admin, 7_000_000);
    expect(m.configuracaoIa.upsert.mock.calls[0][0].update).toEqual({ limiteEspiaoMicroUsd: 7_000_000, atualizadoPorId: "a1" });
    expect(m.auditar).toHaveBeenCalledWith(expect.objectContaining({ acao: "espiao.teto_alterado" }));
  });

  it("coletar agora com coleta em andamento explica", async () => {
    m.iniciar.mockResolvedValue({ coletaId: "c1", iniciou: false, motivo: "em_andamento" });
    await expect(coletarAgora(admin)).rejects.toThrow("Já existe uma coleta em andamento");
    m.iniciar.mockResolvedValue({ coletaId: "c2", iniciou: true });
    await expect(coletarAgora(admin)).resolves.toBeUndefined();
    expect(m.auditar).toHaveBeenCalledWith(expect.objectContaining({ acao: "espiao.coleta_manual", entidadeId: "c2" }));
  });
});
