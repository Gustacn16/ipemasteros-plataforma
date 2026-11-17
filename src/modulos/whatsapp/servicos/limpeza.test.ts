import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que a limpeza usa.
const banco = vi.hoisted(() => {
  const estado = {
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const prisma = {
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) =>
        estado.conversas
          .filter(
            (c) =>
              c.tipo === where.tipo &&
              c.monitorada === where.monitorada &&
              c.provisoriaAte !== null &&
              c.provisoriaAte < where.provisoriaAte.lt,
          )
          .map((c) => ({ id: c.id })),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Linha }) => {
        const alvo = estado.conversas.filter((c) => where.id.in.includes(c.id));
        alvo.forEach((c) => Object.assign(c, data));
        return { count: alvo.length };
      },
    },
    mensagemWhatsapp: {
      findMany: async ({ where, take }: { where: Linha; take: number }) =>
        estado.mensagens
          .filter((m) =>
            where.conversaId?.in
              ? where.conversaId.in.includes(m.conversaId)
              : m.enviadaEm < where.enviadaEm.lt,
          )
          .slice(0, take)
          .map((m) => ({ id: m.id })),
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        const antes = estado.mensagens.length;
        estado.mensagens = estado.mensagens.filter((m) => !where.id.in.includes(m.id));
        return { count: antes - estado.mensagens.length };
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

import { limparWhatsapp } from "./limpeza";

const AGORA = new Date("2026-11-17T12:00:00Z");
const horas = (h: number) => new Date(AGORA.getTime() + h * 3600_000);
const dias = (d: number) => horas(d * 24);

function conversa(id: string, dados: Linha) {
  banco.estado.conversas.push({ id, tipo: "grupo", monitorada: false, provisoriaAte: null, ...dados });
}
function mensagem(id: string, conversaId: string, enviadaEm: Date) {
  banco.estado.mensagens.push({ id, conversaId, enviadaEm });
}

describe("limparWhatsapp", () => {
  beforeEach(() => {
    banco.estado.conversas = [];
    banco.estado.mensagens = [];
  });

  it("apaga a provisória vencida de grupo não monitorado e zera provisoriaAte", async () => {
    conversa("g1", { provisoriaAte: horas(-1) });
    mensagem("m1", "g1", dias(-3));
    const r = await limparWhatsapp(AGORA);
    expect(r).toEqual({ provisorias: 1, antigas: 0 });
    expect(banco.estado.mensagens).toHaveLength(0);
    expect(banco.estado.conversas[0].provisoriaAte).toBeNull();
  });

  it("não apaga de grupo que virou monitorado nem provisória ainda no prazo", async () => {
    conversa("g1", { monitorada: true, provisoriaAte: horas(-1) });
    conversa("g2", { provisoriaAte: horas(5) });
    mensagem("m1", "g1", dias(-3));
    mensagem("m2", "g2", dias(-3));
    const r = await limparWhatsapp(AGORA);
    expect(r).toEqual({ provisorias: 0, antigas: 0 });
    expect(banco.estado.mensagens).toHaveLength(2);
  });

  it("apaga mensagem de 91 dias e mantém a de 89", async () => {
    conversa("g1", { monitorada: true });
    mensagem("velha", "g1", dias(-91));
    mensagem("nova", "g1", dias(-89));
    const r = await limparWhatsapp(AGORA);
    expect(r).toEqual({ provisorias: 0, antigas: 1 });
    expect(banco.estado.mensagens.map((m) => m.id)).toEqual(["nova"]);
  });

  it("apaga em lotes de 5000 até acabar", async () => {
    conversa("g1", { monitorada: true });
    for (let i = 0; i < 5001; i++) mensagem(`m${i}`, "g1", dias(-100));
    const r = await limparWhatsapp(AGORA);
    expect(r.antigas).toBe(5001);
    expect(banco.estado.mensagens).toHaveLength(0);
  });
});
