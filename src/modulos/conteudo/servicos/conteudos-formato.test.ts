import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

// Banco de mentira: um formato "Entrevista" no YouTube (k-yt) da marca m1; o Instagram (k-ig) é da mesma marca.
const banco = vi.hoisted(() => {
  const estado = {
    criado: null as null | Record<string, unknown>,
    formatos: {
      "f-entrevista": { id: "f-entrevista", ativo: true, canal: { id: "k-yt", marcaId: "m1", ativo: true } },
      "f-outra-marca": { id: "f-outra-marca", ativo: true, canal: { id: "k-x", marcaId: "m2", ativo: true } },
      "f-inativo": { id: "f-inativo", ativo: false, canal: { id: "k-yt", marcaId: "m1", ativo: true } },
    } as Record<string, unknown>,
  };
  const tx = {
    conteudo: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        estado.criado = data;
        return { id: "c-novo", ...data };
      },
    },
  };
  const prisma = {
    formatoCanal: { findFirst: async ({ where }: { where: { id: string } }) => estado.formatos[where.id] ?? null },
    canal: { count: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.filter((id) => ["k-yt", "k-ig"].includes(id)).length },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  return { prisma, estado };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/auditoria", () => ({ registrarAuditoria: async () => undefined }));

const { criarConteudo } = await import("./conteudos");
const colaborador = { id: "u1", papel: "colaborador" } as UsuarioAtual;
const novo = { titulo: "Entrevista com o Dr. X", formatoId: "f-entrevista", canalIds: [] as string[], dataPublicacao: null, etapa: "ideia" as const };

describe("criar conteúdo com formato do canal", () => {
  beforeEach(() => {
    banco.estado.criado = null;
  });

  it("a marca e o canal principal vêm do formato, e o canal principal sempre tem publicação", async () => {
    await criarConteudo(colaborador, { ...novo, canalIds: ["k-ig"] });
    expect(banco.estado.criado).toMatchObject({ marcaId: "m1", formatoId: "f-entrevista", etapa: "ideia" });
    expect(banco.estado.criado?.publicacoes).toEqual({ create: [{ canalId: "k-yt" }, { canalId: "k-ig" }] });
  });

  it("não repete o canal principal quando ele também vem nos extras", async () => {
    await criarConteudo(colaborador, { ...novo, canalIds: ["k-yt"] });
    expect(banco.estado.criado?.publicacoes).toEqual({ create: [{ canalId: "k-yt" }] });
  });

  it("recusa formato desativado", async () => {
    await expect(criarConteudo(colaborador, { ...novo, formatoId: "f-inativo" })).rejects.toThrow("Escolha um formato");
  });

  it("canal extra de outra conta é recusado", async () => {
    await expect(criarConteudo(colaborador, { ...novo, canalIds: ["k-x"] })).rejects.toThrow("mesma conta");
  });

  it("colaborador não cria já aprovado; nasce na etapa da coluna", async () => {
    await expect(criarConteudo(colaborador, { ...novo, etapa: "aprovado" })).rejects.toThrow("não pode começar");
    await criarConteudo(colaborador, { ...novo, etapa: "a_gravar" });
    expect(banco.estado.criado).toMatchObject({ etapa: "a_gravar" });
  });

  it("grava a legenda na criação; sem legenda, fica vazia", async () => {
    await criarConteudo(colaborador, { ...novo, legenda: "Legenda pronta" });
    expect(banco.estado.criado).toMatchObject({ legenda: "Legenda pronta" });
    await criarConteudo(colaborador, novo);
    expect(banco.estado.criado).toMatchObject({ legenda: null });
  });
});
