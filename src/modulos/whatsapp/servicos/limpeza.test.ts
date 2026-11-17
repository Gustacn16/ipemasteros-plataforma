import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que a limpeza usa.
const banco = vi.hoisted(() => {
  const estado = {
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  // Filtro de mensagem: id, conversaId, enviadaEm e a relação conversa (monitorada/tipo).
  const combina = (m: Linha, where: Linha) => {
    if (where.id?.in && !where.id.in.includes(m.id)) return false;
    if (where.conversaId?.in && !where.conversaId.in.includes(m.conversaId)) return false;
    if (where.enviadaEm?.lt && !(m.enviadaEm < where.enviadaEm.lt)) return false;
    if (where.conversa) {
      const c = estado.conversas.find((x) => x.id === m.conversaId);
      if (!c || Object.entries(where.conversa).some(([k, v]) => c[k] !== v)) return false;
    }
    return true;
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
      updateMany: async ({ where, data }: { where: { id: { in: string[] }; monitorada?: boolean }; data: Linha }) => {
        const alvo = estado.conversas.filter(
          (c) => where.id.in.includes(c.id) && (where.monitorada === undefined || c.monitorada === where.monitorada),
        );
        alvo.forEach((c) => Object.assign(c, data));
        return { count: alvo.length };
      },
    },
    mensagemWhatsapp: {
      findMany: async ({ where, take }: { where: Linha; take: number }) =>
        estado.mensagens
          .filter((m) => combina(m, where))
          .slice(0, take)
          .map((m) => ({ id: m.id })),
      deleteMany: async ({ where }: { where: Linha }) => {
        const antes = estado.mensagens.length;
        estado.mensagens = estado.mensagens.filter((m) => !combina(m, where));
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

  it("grupo marcado como monitorado durante a limpeza não perde mensagens nem o prazo", async () => {
    conversa("g1", { provisoriaAte: horas(-1) });
    mensagem("m1", "g1", dias(-3));
    const original = banco.prisma.conversaWhatsapp.findMany;
    const busca = vi.spyOn(banco.prisma.conversaWhatsapp, "findMany").mockImplementationOnce(async (args) => {
      const r = await original(args);
      banco.estado.conversas[0].monitorada = true; // alguém marcou o grupo logo depois da busca
      return r;
    });
    const r = await limparWhatsapp(AGORA);
    expect(r).toEqual({ provisorias: 0, antigas: 0 });
    expect(banco.estado.mensagens).toHaveLength(1);
    expect(banco.estado.conversas[0].provisoriaAte).toEqual(horas(-1));
    busca.mockRestore();
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
