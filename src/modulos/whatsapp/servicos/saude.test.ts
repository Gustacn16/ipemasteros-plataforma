import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    usos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    config: null as Record<string, any> | null, // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  // Como no mock de captura.test.ts: o LIKE do MySQL da Hostinger não pode ser usado.
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const prisma = {
    usoIa: {
      aggregate: async ({ where }: { where: Linha }) => {
        semLike(where);
        const soma = estado.usos
          .filter((u) => u.origem === where.origem && u.criadoEm >= where.criadoEm.gte)
          .reduce((t, u) => t + u.custoMicroUsd, 0);
        return { _sum: { custoMicroUsd: soma || null } };
      },
    },
    configuracaoWhatsapp: { findUnique: async () => estado.config },
    numeroWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        // Aplica o filtro de excluidoEm que a consulta pedir (null: só os não excluídos).
        if (!("excluidoEm" in where)) return estado.numeros.map((n) => ({ ...n }));
        return estado.numeros.filter((n) => n.excluidoEm === where.excluidoEm).map((n) => ({ ...n }));
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
  banco.estado.usos = [];
  banco.estado.config = null;
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

describe("saudeWhatsapp: IA", () => {
  it("saúde traz gasto do mês só da origem whatsapp e o limite", async () => {
    banco.estado.config = { id: "unica", modelo: "claude-opus-5-5", limiteMensalMicroUsd: 50_000_000 };
    banco.estado.usos = [
      { origem: "whatsapp", custoMicroUsd: 3_000_000, criadoEm: new Date("2026-11-05T12:00:00Z") },
      { origem: "whatsapp", custoMicroUsd: 2_000_000, criadoEm: new Date("2026-11-10T12:00:00Z") },
      { origem: "whatsapp", custoMicroUsd: 9_000_000, criadoEm: new Date("2026-10-31T12:00:00Z") },
      { origem: "nexu", custoMicroUsd: 7_000_000, criadoEm: new Date("2026-11-06T12:00:00Z") },
    ];
    const { ia } = await saudeWhatsapp(agora);
    expect(ia.gastoMesMicroUsd).toBe(5_000_000);
    expect(ia.limiteMensalMicroUsd).toBe(50_000_000);
  });

  it("sem configuração usa o limite padrão de US$ 80 e sem gasto soma zero", async () => {
    const { ia } = await saudeWhatsapp(agora);
    expect(ia).toMatchObject({ gastoMesMicroUsd: 0, limiteMensalMicroUsd: 80_000_000 });
  });
});
