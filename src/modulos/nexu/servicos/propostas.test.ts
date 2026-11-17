import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

const m = vi.hoisted(() => {
  const prisma = {
    propostaNexu: {
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    tarefa: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return {
    prisma,
    criarTarefa: vi.fn(),
    mudarStatus: vi.fn(),
    adicionarItemChecklist: vi.fn(),
    criarEvento: vi.fn(),
    criarConteudo: vi.fn(),
    criarVenda: vi.fn(),
    registrarAuditoria: vi.fn(),
    anexarMensagens: vi.fn(),
    exigirLista: vi.fn(),
    usuariosAtribuiveis: vi.fn(),
    exigirTarefa: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auditoria", () => ({ registrarAuditoria: m.registrarAuditoria }));
vi.mock("./conversas", () => ({ anexarMensagens: m.anexarMensagens }));
vi.mock("@/modulos/tarefas/servicos/tarefas", () => ({ criarTarefa: m.criarTarefa, mudarStatus: m.mudarStatus }));
vi.mock("@/modulos/tarefas/servicos/detalhes", () => ({ adicionarItemChecklist: m.adicionarItemChecklist }));
vi.mock("@/modulos/tarefas/servicos/acesso", () => ({
  exigirLista: m.exigirLista,
  usuariosAtribuiveis: m.usuariosAtribuiveis,
  exigirTarefa: m.exigirTarefa,
  podeEditarTarefa: () => true,
}));
vi.mock("@/modulos/agenda/servicos/eventos", () => ({ criarEvento: m.criarEvento }));
vi.mock("@/modulos/conteudo/servicos/conteudos", () => ({ criarConteudo: m.criarConteudo }));
vi.mock("@/modulos/comercial/servicos/vendas", () => ({ criarVenda: m.criarVenda }));

const { confirmarProposta, recusarProposta } = await import("./propostas");
const { ferramentaProporCriarTarefa } = await import("../ferramentas/acoes");
const { ErroPermissao } = await import("@/lib/permissoes");

const criador = { id: "u1", nome: "Ana", papel: "gestor" } as UsuarioAtual;
// Mesmo usuário, numa nova requisição (o papel é relido a cada requisição).
const quemConfirma = { id: "u1", nome: "Ana", papel: "colaborador" } as UsuarioAtual;

const pendente = {
  id: "p1",
  conversaId: "c1",
  usuarioId: "u1",
  toolUseId: "t1",
  tipo: "criar_tarefa",
  dados: { tipo: "criar_tarefa", listaId: "l1", titulo: "Revisar post", dataEntrega: "2026-11-21", responsaveis: ["u2"] },
  resumo: "Criar tarefa: Revisar post · Responsável: Bia · Prazo: 21/11 · Lista: Conteúdo",
  status: "executando",
  erro: null,
  resultadoId: null,
  resultadoUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.propostaNexu.findUniqueOrThrow.mockResolvedValue(pendente);
  m.prisma.propostaNexu.update.mockImplementation(async ({ data }: { data: object }) => ({ ...pendente, ...data }));
  m.prisma.propostaNexu.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "p9",
    erro: null,
    resultadoUrl: null,
    status: "pendente",
    ...data,
  }));
});

describe("confirmarProposta", () => {
  it("updateMany devolvendo 0: 'Esta proposta já foi decidida.' e o serviço não é chamado", async () => {
    m.prisma.propostaNexu.updateMany.mockResolvedValue({ count: 0 });
    await expect(confirmarProposta(quemConfirma, "p1")).rejects.toThrow("Esta proposta já foi decidida.");
    expect(m.criarTarefa).not.toHaveBeenCalled();
    expect(m.prisma.propostaNexu.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", usuarioId: "u1", status: "pendente" },
      data: { status: "executando" },
    });
  });

  it("proposta de outro usuário: mesmo erro (o filtro usa o id de quem confirma)", async () => {
    m.prisma.propostaNexu.updateMany.mockImplementation(async ({ where }: { where: { usuarioId: string } }) => ({
      count: where.usuarioId === "u1" ? 1 : 0,
    }));
    const outro = { id: "u2", nome: "Bia", papel: "admin" } as UsuarioAtual;
    await expect(confirmarProposta(outro, "p1")).rejects.toThrow("Esta proposta já foi decidida.");
    expect(m.criarTarefa).not.toHaveBeenCalled();
  });

  it("o serviço lança ErroPermissao: status falhou com 'Você não tem permissão para esta ação.'", async () => {
    m.prisma.propostaNexu.updateMany.mockResolvedValue({ count: 1 });
    m.criarTarefa.mockRejectedValue(new ErroPermissao("tarefas:criar"));
    const r = await confirmarProposta(quemConfirma, "p1");
    expect(r).toMatchObject({ id: "p1", status: "falhou", erro: "Você não tem permissão para esta ação.", resultadoUrl: null });
    expect(m.prisma.propostaNexu.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ status: "falhou", erro: "Você não tem permissão para esta ação." }),
    });
    expect(m.registrarAuditoria).not.toHaveBeenCalled();
    expect(m.anexarMensagens).toHaveBeenCalledWith("c1", [
      { papel: "usuario", conteudo: "[A proposta falhou: Você não tem permissão para esta ação.]" },
    ]);
  });

  it("erro inesperado: falhou com 'Não foi possível concluir.' e log só com o id", async () => {
    m.prisma.propostaNexu.updateMany.mockResolvedValue({ count: 1 });
    m.criarTarefa.mockRejectedValue(new Error("detalhe interno"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await confirmarProposta(quemConfirma, "p1");
    expect(r).toMatchObject({ status: "falhou", erro: "Não foi possível concluir." });
    expect(JSON.stringify(log.mock.calls)).not.toContain("detalhe interno");
    expect(JSON.stringify(log.mock.calls)).toContain("p1");
    log.mockRestore();
  });

  it("sucesso de criar_tarefa: roda como quem confirma, vira confirmada com URL, auditoria e mensagem", async () => {
    m.prisma.propostaNexu.updateMany.mockResolvedValue({ count: 1 });
    m.criarTarefa.mockResolvedValue({ id: "tar1" });
    const r = await confirmarProposta(quemConfirma, "p1");
    expect(m.criarTarefa).toHaveBeenCalledTimes(1);
    expect(m.criarTarefa.mock.calls[0][0]).toBe(quemConfirma);
    expect(m.criarTarefa.mock.calls[0][0]).not.toBe(criador);
    expect(m.criarTarefa.mock.calls[0][1]).toMatchObject({
      listaId: "l1",
      titulo: "Revisar post",
      responsaveis: ["u2"],
      dataEntrega: new Date("2026-11-21T00:00:00Z"),
    });
    expect(r).toEqual({
      id: "p1",
      tipo: "criar_tarefa",
      resumo: pendente.resumo,
      status: "confirmada",
      erro: null,
      resultadoUrl: "/tarefas/listas/l1?tarefa=tar1",
    });
    expect(m.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: "u1",
        acao: "nexu.proposta_confirmada",
        entidadeId: "p1",
        diff: { tipo: "criar_tarefa", resultadoId: "tar1" },
      }),
      m.prisma,
    );
    expect(m.anexarMensagens).toHaveBeenCalledWith("c1", [{ papel: "usuario", conteudo: `[Confirmei a proposta: ${pendente.resumo}]` }]);
  });
});

describe("recusarProposta", () => {
  it("pendente → recusada, com a mensagem na conversa e sem chamar o módulo", async () => {
    m.prisma.propostaNexu.updateMany.mockResolvedValue({ count: 1 });
    m.prisma.propostaNexu.findUniqueOrThrow.mockResolvedValue({ ...pendente, status: "recusada" });
    const r = await recusarProposta(quemConfirma, "p1");
    expect(r.status).toBe("recusada");
    expect(m.prisma.propostaNexu.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", usuarioId: "u1", status: "pendente" },
      data: expect.objectContaining({ status: "recusada" }),
    });
    expect(m.criarTarefa).not.toHaveBeenCalled();
    expect(m.anexarMensagens).toHaveBeenCalledWith("c1", [{ papel: "usuario", conteudo: `[Recusei a proposta: ${pendente.resumo}]` }]);
  });

  it("já decidida: erro", async () => {
    m.prisma.propostaNexu.updateMany.mockResolvedValue({ count: 0 });
    await expect(recusarProposta(quemConfirma, "p1")).rejects.toThrow("Esta proposta já foi decidida.");
  });
});

describe("propor_criar_tarefa", () => {
  const ctx = { conversaId: "c1", toolUseId: "t1" };

  beforeEach(() => {
    m.exigirLista.mockResolvedValue({ id: "l1", nome: "Conteúdo", espacoId: "e1" });
    m.usuariosAtribuiveis.mockResolvedValue([{ id: "u2", nome: "Bia" }]);
  });

  it("responsável que não existe: erro de ferramenta e nenhuma proposta gravada", async () => {
    await expect(
      ferramentaProporCriarTarefa.executar(criador, { listaId: "l1", titulo: "Revisar post", responsaveis: ["id-que-nao-existe"] }, ctx),
    ).rejects.toThrow(/Responsável/);
    expect(m.prisma.propostaNexu.create).not.toHaveBeenCalled();
  });

  it("dados válidos: grava pendente com resumo legível e devolve a proposta visível", async () => {
    const r = (await ferramentaProporCriarTarefa.executar(
      criador,
      { listaId: "l1", titulo: "Revisar post de sexta", responsaveis: ["u2"], dataEntrega: "2026-11-21" },
      ctx,
    )) as { proposta: { resumo: string; status: string } };
    expect(m.prisma.propostaNexu.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conversaId: "c1", usuarioId: "u1", toolUseId: "t1", tipo: "criar_tarefa" }),
      }),
    );
    // Só os campos do tipo vão para `dados` (sem undefined).
    expect(m.prisma.propostaNexu.create.mock.calls[0][0].data.dados).toEqual({
      tipo: "criar_tarefa",
      listaId: "l1",
      titulo: "Revisar post de sexta",
      responsaveis: ["u2"],
      dataEntrega: "2026-11-21",
    });
    expect(r.proposta.status).toBe("pendente");
    expect(r.proposta.resumo).toBe("Criar tarefa: Revisar post de sexta · Responsável: Bia · Prazo: 21/11 · Lista: Conteúdo");
  });

  it("lista invisível: erro de ferramenta, nada gravado", async () => {
    const { ErroNegocio } = await import("@/lib/erros");
    m.exigirLista.mockRejectedValue(new ErroNegocio("Não encontrado."));
    await expect(ferramentaProporCriarTarefa.executar(criador, { listaId: "lx", titulo: "X" }, ctx)).rejects.toThrow();
    expect(m.prisma.propostaNexu.create).not.toHaveBeenCalled();
  });
});
