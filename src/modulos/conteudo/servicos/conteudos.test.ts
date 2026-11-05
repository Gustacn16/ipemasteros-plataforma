import { describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

// Só a publicação lida antes de qualquer gravação.
const banco = vi.hoisted(() => {
  const publicacao = {
    id: "pub1",
    conteudoId: "c1",
    status: "publicado",
    metricasOrigem: "instagram",
    conteudo: { id: "c1", etapa: "publicado" },
  };
  const prisma = {
    publicacao: {
      findFirst: async () => publicacao,
      update: async () => {
        throw new Error("não devia gravar");
      },
    },
    $transaction: async () => {
      throw new Error("não devia gravar");
    },
  };
  return { prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/auditoria", () => ({ registrarAuditoria: async () => undefined }));

const { registrarPublicacao, salvarMetricas } = await import("./conteudos");
const colaborador = { id: "u1", papel: "colaborador" } as UsuarioAtual;

describe("publicação com números do Instagram", () => {
  it("não aceita números digitados à mão", async () => {
    await expect(
      salvarMetricas(colaborador, "pub1", {
        alcance: 1,
        visualizacoes: 1,
        curtidas: 1,
        comentarios: 1,
        compartilhamentos: 1,
        salvamentos: 1,
      }),
    ).rejects.toThrow("Os números desta publicação vêm do Instagram.");
  });

  it("não pode ser desmarcada enquanto o post estiver ligado", async () => {
    await expect(registrarPublicacao(colaborador, "pub1", { publicado: false, url: null, data: null })).rejects.toThrow(
      "Desligue o post do Instagram antes de desmarcar esta publicação.",
    );
  });
});
