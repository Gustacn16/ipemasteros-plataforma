import { describe, expect, it, vi } from "vitest";

// Grava as chamadas ao banco para conferir o que desligar e a ligação automática pedem.
const banco = vi.hoisted(() => {
  const chamadas: { modelo: string; op: string; args: Record<string, unknown> }[] = [];
  const modelo = (nome: string, respostas: Record<string, unknown> = {}) =>
    new Proxy(
      {},
      {
        get: (_alvo, op: string) => async (args: Record<string, unknown>) => {
          chamadas.push({ modelo: nome, op, args });
          return respostas[op] ?? null;
        },
      },
    );
  const tx = {
    midiaInstagram: modelo("midiaInstagram", { findUniqueOrThrow: { publicacaoId: "pub1" } }),
    publicacao: modelo("publicacao"),
  };
  const prisma = { ...tx, $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  return { chamadas, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

const { desligarNoBanco } = await import("./ligacao-instagram");
const { repositorioPrisma } = await import("./repositorio-instagram");

describe("desligar um post", () => {
  it("marca o post como desligado para a ligação automática não refazer", async () => {
    await desligarNoBanco("m1");
    const update = banco.chamadas.find((c) => c.modelo === "midiaInstagram" && c.op === "update");
    expect(update?.args).toMatchObject({ where: { id: "m1" }, data: { publicacaoId: null } });
    expect((update?.args.data as { desligadaEm?: unknown }).desligadaEm).toBeInstanceOf(Date);
  });

  it("a ligação automática ignora posts desligados à mão", async () => {
    await repositorioPrisma.midiasSemLigacao("c1");
    const busca = banco.chamadas.findLast((c) => c.modelo === "midiaInstagram" && c.op === "findMany");
    expect(busca?.args.where).toMatchObject({ contaId: "c1", publicacaoId: null, removidaEm: null, desligadaEm: null });
  });
});
