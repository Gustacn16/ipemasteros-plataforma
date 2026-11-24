import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

const m = vi.hoisted(() => {
  const tx = {
    tipoEvento: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    conversaWhatsapp: { findMany: vi.fn() },
    grupoPadraoTipoEvento: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  return { tx, auditoria: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { ...m.tx, $transaction: async (f: (t: typeof m.tx) => unknown) => f(m.tx) } }));
vi.mock("@/lib/auditoria", () => ({ registrarAuditoria: m.auditoria }));

import { listarTiposParaAvisos, salvarTipoParaAvisos } from "./avisos-config";

const gestor = { id: "u1", papel: "admin" } as unknown as UsuarioAtual;
const comercial = { id: "u2", papel: "comercial" } as unknown as UsuarioAtual;

beforeEach(() => {
  vi.resetAllMocks();
  m.tx.tipoEvento.findUnique.mockResolvedValue({ id: "t1", ativo: true });
  m.tx.conversaWhatsapp.findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
});

describe("listarTiposParaAvisos", () => {
  it("exige whatsapp:avisos", async () => {
    await expect(listarTiposParaAvisos(comercial)).rejects.toBeInstanceOf(ErroPermissao);
  });
  it("devolve só tipos ativos com os grupos padrão", async () => {
    m.tx.tipoEvento.findMany.mockResolvedValue([
      { id: "t1", nome: "Aula", cor: "#fff", divulgarNosGrupos: true, gruposPadrao: [{ conversaId: "g1" }] },
    ]);
    expect(await listarTiposParaAvisos(gestor)).toEqual([{ id: "t1", nome: "Aula", cor: "#fff", divulgar: true, grupos: ["g1"] }]);
    expect(m.tx.tipoEvento.findMany.mock.calls[0][0].where).toEqual({ ativo: true });
  });
});

describe("salvarTipoParaAvisos", () => {
  it("exige whatsapp:avisos", async () => {
    await expect(salvarTipoParaAvisos(comercial, { tipoId: "t1", divulgar: true, grupos: [] })).rejects.toBeInstanceOf(ErroPermissao);
  });
  it("grava a marca, troca os grupos e audita", async () => {
    await salvarTipoParaAvisos(gestor, { tipoId: "t1", divulgar: true, grupos: ["g1", "g2", "g1"] });
    expect(m.tx.tipoEvento.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { divulgarNosGrupos: true } });
    expect(m.tx.grupoPadraoTipoEvento.deleteMany).toHaveBeenCalledWith({ where: { tipoId: "t1" } });
    expect(m.tx.grupoPadraoTipoEvento.createMany).toHaveBeenCalledWith({
      data: [{ tipoId: "t1", conversaId: "g1" }, { tipoId: "t1", conversaId: "g2" }],
    });
    expect(m.auditoria).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: "u1", acao: "whatsapp.avisos.config", entidade: "TipoEvento", entidadeId: "t1", diff: { divulgar: true, grupos: 2 } }),
      m.tx,
    );
  });
  it("desligado e sem grupos não cria linhas", async () => {
    await salvarTipoParaAvisos(gestor, { tipoId: "t1", divulgar: false, grupos: [] });
    expect(m.tx.grupoPadraoTipoEvento.createMany).not.toHaveBeenCalled();
  });
  it("recusa tipo inativo ou inexistente", async () => {
    m.tx.tipoEvento.findUnique.mockResolvedValue({ id: "t1", ativo: false });
    await expect(salvarTipoParaAvisos(gestor, { tipoId: "t1", divulgar: true, grupos: [] })).rejects.toBeInstanceOf(ErroNegocio);
  });
  it("recusa grupo que não é grupo monitorado", async () => {
    m.tx.conversaWhatsapp.findMany.mockResolvedValue([{ id: "g1" }]);
    await expect(salvarTipoParaAvisos(gestor, { tipoId: "t1", divulgar: true, grupos: ["g1", "gx"] })).rejects.toBeInstanceOf(ErroNegocio);
    expect(m.tx.tipoEvento.update).not.toHaveBeenCalled();
  });
});
