import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroMeta } from "@/lib/meta-graph";
import type { UsuarioAtual } from "@/lib/sessao";
import type { ClienteInstagram } from "./instagram-graph";

// Banco em memória só com o que a tela da integração usa.
const banco = vi.hoisted(() => {
  const estado = {
    canais: [] as { id: string; plataforma: string; ativo: boolean; excluidoEm: Date | null; identificador: string | null }[],
    contas: [] as { id: string; canalId: string | null; ativa: boolean }[],
  };
  const prisma = {
    canal: {
      findFirst: async ({ where }: { where: { id: string } }) => estado.canais.find((c) => c.id === where.id) ?? null,
      findMany: async () => [],
    },
    contaInstagram: {
      findUnique: async ({ where }: { where: { id: string } }) => estado.contas.find((c) => c.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { canalId: string; id: { not: string } } }) =>
        estado.contas.find((c) => c.canalId === where.canalId && c.id !== where.id.not) ?? null,
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Object.assign(
          estado.contas.find((c) => c.id === where.id)!,
          data,
        ),
    },
    atualizacaoInstagram: { findMany: async () => [] },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

const { ligarContaCanal, situacaoIntegracao } = await import("./integracao-instagram");

const admin = { id: "u1", papel: "admin" } as UsuarioAtual;
const gestor = { id: "u2", papel: "gestor" } as UsuarioAtual;

beforeEach(() => {
  banco.estado.canais = [
    { id: "ig", plataforma: "instagram", ativo: true, excluidoEm: null, identificador: "@ipemaster" },
    { id: "yt", plataforma: "youtube", ativo: true, excluidoEm: null, identificador: null },
    { id: "ig2", plataforma: "instagram", ativo: true, excluidoEm: null, identificador: "@outro" },
  ];
  banco.estado.contas = [
    { id: "c1", canalId: null, ativa: true },
    { id: "c2", canalId: "ig2", ativa: true },
  ];
  process.env.META_ACCESS_TOKEN = "TOKEN";
});

describe("ligarContaCanal", () => {
  it("liga a conta a um canal do Instagram", async () => {
    await ligarContaCanal(admin, "c1", "ig");
    expect(banco.estado.contas[0]!.canalId).toBe("ig");
  });

  it("desliga com canal vazio", async () => {
    await ligarContaCanal(admin, "c2", null);
    expect(banco.estado.contas[1]!.canalId).toBeNull();
  });

  it("recusa canal de outra plataforma", async () => {
    await expect(ligarContaCanal(admin, "c1", "yt")).rejects.toThrow("Escolha um canal ativo do Instagram.");
  });

  it("recusa canal já ligado a outra conta", async () => {
    await expect(ligarContaCanal(admin, "c1", "ig2")).rejects.toThrow("Este canal já está ligado a outra conta.");
  });

  it("recusa quem não é admin", async () => {
    await expect(ligarContaCanal(gestor, "c1", "ig")).rejects.toThrow();
    expect(banco.estado.contas[0]!.canalId).toBeNull();
  });
});

describe("situacaoIntegracao", () => {
  const cliente = (permissoes: ClienteInstagram["permissoes"]) => ({ permissoes }) as ClienteInstagram;

  it("lista as permissões que faltam, na ordem", async () => {
    const s = await situacaoIntegracao(
      admin,
      cliente(async () => [
        { permission: "instagram_basic", status: "granted" },
        { permission: "pages_show_list", status: "granted" },
      ]),
    );
    expect(s.situacao).toBe("falta_permissao");
    expect(s.faltando).toEqual(["instagram_manage_insights", "pages_read_engagement"]);
  });

  it("chave inválida e não configurada", async () => {
    const invalida = await situacaoIntegracao(
      admin,
      cliente(async () => {
        throw new ErroMeta("A chave de acesso da Meta é inválida ou foi revogada.", 190);
      }),
    );
    expect(invalida.situacao).toBe("chave_invalida");
    delete process.env.META_ACCESS_TOKEN;
    expect((await situacaoIntegracao(admin)).situacao).toBe("nao_configurada");
  });

  it("recusa quem não é admin", async () => {
    await expect(situacaoIntegracao(gestor)).rejects.toThrow();
  });
});
