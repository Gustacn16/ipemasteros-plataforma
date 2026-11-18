import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = { linha: null as Record<string, any> | null, auditorias: [] as Record<string, any>[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const prisma = {
    configuracaoWhatsapp: {
      findUnique: async () => estado.linha,
      upsert: async ({ create, update }: Linha) => {
        estado.linha = estado.linha ? { ...estado.linha, ...update } : { ...create };
        return estado.linha;
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: async (dados: Linha) => {
    banco.estado.auditorias.push(dados);
  },
}));

const { obterConfiguracaoWhatsapp, salvarConfiguracaoWhatsapp } = await import("./configuracao");

describe("configuração do WhatsApp", () => {
  beforeEach(() => {
    banco.estado.linha = null;
    banco.estado.auditorias = [];
  });

  it("sem linha devolve opus e US$ 80", async () => {
    expect(await obterConfiguracaoWhatsapp()).toEqual({ modelo: "claude-opus-5-5", limiteMensalMicroUsd: 80_000_000 });
  });

  it("modelo desconhecido cai no padrão", async () => {
    banco.estado.linha = { id: "unica", modelo: "gpt-x", limiteMensalMicroUsd: 5_000_000 };
    expect(await obterConfiguracaoWhatsapp()).toEqual({ modelo: "claude-opus-5-5", limiteMensalMicroUsd: 5_000_000 });
  });

  it("salvar fora de 0..500_000_000 lança", async () => {
    await expect(salvarConfiguracaoWhatsapp({ limiteMensalMicroUsd: -1 }, "u1")).rejects.toThrow();
    await expect(salvarConfiguracaoWhatsapp({ limiteMensalMicroUsd: 500_000_001 }, "u1")).rejects.toThrow();
    expect(banco.estado.linha).toBeNull();
    await salvarConfiguracaoWhatsapp({ limiteMensalMicroUsd: 0 }, "u1");
    await salvarConfiguracaoWhatsapp({ limiteMensalMicroUsd: 500_000_000 }, "u1");
    expect((await obterConfiguracaoWhatsapp()).limiteMensalMicroUsd).toBe(500_000_000);
  });

  it("salvar audita só o valor, sem outros dados", async () => {
    await salvarConfiguracaoWhatsapp({ limiteMensalMicroUsd: 10_000_000 }, "u1");
    expect(banco.estado.auditorias).toEqual([
      {
        usuarioId: "u1",
        acao: "whatsapp.configuracao_alterada",
        entidade: "ConfiguracaoWhatsapp",
        entidadeId: "unica",
        diff: { limiteMensalMicroUsd: 10_000_000 },
      },
    ]);
  });
});
