import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  // Como no mock de captura.test.ts: o LIKE do MySQL da Hostinger não pode ser usado.
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const prisma = {
    numeroWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.numeros.filter((n) => where.excluidoEm !== null || n.excluidoEm === null).filter((n) => n.excluidoEm === null);
      },
    },
    mensagemWhatsapp: {
      groupBy: async ({ where }: { where: Linha }) => {
        semLike(where);
        const por = new Map<string, Linha[]>();
        for (const m of estado.mensagens.filter((m) => m.enviadaEm >= where.enviadaEm.gte)) {
          por.set(m.numeroId, [...(por.get(m.numeroId) ?? []), m]);
        }
        return [...por].map(([numeroId, ms]) => ({
          numeroId,
          _count: { _all: ms.length },
          _max: { enviadaEm: new Date(Math.max(...ms.map((m) => m.enviadaEm.getTime()))) },
        }));
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

import { saudeWhatsapp } from "./saude";

const agora = new Date("2026-11-18T12:00:00Z");
const min = (m: number) => new Date(agora.getTime() - m * 60_000);
const num = (id: string, extra: Linha = {}) => ({
  id,
  nome: `Número ${id}`,
  situacao: "conectado",
  qrEm: null,
  ultimoSinalEm: min(1),
  erro: null,
  excluidoEm: null,
  ...extra,
});

beforeEach(() => {
  banco.estado.numeros = [];
  banco.estado.mensagens = [];
});

describe("saudeWhatsapp", () => {
  it("motor vivo quando algum número teve sinal há menos de 5 min", async () => {
    banco.estado.numeros = [num("a", { ultimoSinalEm: min(60) }), num("b", { ultimoSinalEm: min(2) })];
    const r = await saudeWhatsapp(agora);
    expect(r.motorVivo).toBe(true);
    expect(r.ultimoSinalEm).toEqual(min(2));
  });

  it("sem sinal há mais de 5 min: motorVivo false", async () => {
    banco.estado.numeros = [num("a", { ultimoSinalEm: min(6) })];
    expect((await saudeWhatsapp(agora)).motorVivo).toBe(false);
    banco.estado.numeros = [];
    const vazio = await saudeWhatsapp(agora);
    expect(vazio.motorVivo).toBe(false);
    expect(vazio.ultimoSinalEm).toBeNull();
  });

  it("conta as mensagens das últimas 24 h por número, pelo numeroId que capturou", async () => {
    banco.estado.numeros = [num("a"), num("b")];
    banco.estado.mensagens = [
      { numeroId: "a", enviadaEm: min(10) },
      { numeroId: "a", enviadaEm: min(30) },
      { numeroId: "a", enviadaEm: min(25 * 60) },
      { numeroId: "b", enviadaEm: min(5) },
    ];
    const r = await saudeWhatsapp(agora);
    const a = r.numeros.find((n) => n.id === "a")!;
    expect(a.mensagens24h).toBe(2);
    expect(a.ultimaMensagemEm).toEqual(min(10));
    expect(r.numeros.find((n) => n.id === "b")!.mensagens24h).toBe(1);
    expect(a.estado).toBe("Conectado");
  });

  it("número sem mensagens aparece com zero", async () => {
    banco.estado.numeros = [num("a")];
    const [a] = (await saudeWhatsapp(agora)).numeros;
    expect(a.mensagens24h).toBe(0);
    expect(a.ultimaMensagemEm).toBeNull();
  });

  it("número excluído não aparece", async () => {
    banco.estado.numeros = [num("a"), num("x", { excluidoEm: min(100) })];
    expect((await saudeWhatsapp(agora)).numeros.map((n) => n.id)).toEqual(["a"]);
  });
});
