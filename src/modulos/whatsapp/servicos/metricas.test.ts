import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    metricas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    consultasMensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
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
        return estado.numeros.filter((n) => n.excluidoEm === where.excluidoEm).map((n) => ({ ...n }));
      },
    },
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.conversas
          .filter((c) => {
            if (c.tipo !== where.tipo) return false;
            if (!where.categoria.in.includes(c.categoria)) return false;
            const n = estado.numeros.find((x) => x.id === c.numeroId);
            return !!n && n.excluidoEm === where.numero.excluidoEm;
          })
          .map((c) => ({ id: c.id, numeroId: c.numeroId }));
      },
    },
    mensagemWhatsapp: {
      findMany: async (args: { where: Linha; select: Linha; orderBy: Linha[] }) => {
        semLike(args.where);
        estado.consultasMensagens.push(args);
        return estado.mensagens
          .filter((m) => args.where.conversaId.in.includes(m.conversaId) && m.enviadaEm >= args.where.enviadaEm.gte)
          .sort((a, b) => a.enviadaEm.getTime() - b.enviadaEm.getTime() || (a.id < b.id ? -1 : 1))
          .map((m) => ({ conversaId: m.conversaId, deMim: m.deMim, enviadaEm: m.enviadaEm }));
      },
    },
    metricaAtendimentoDia: {
      findMany: async () => {
        const ids = [...new Set(estado.metricas.map((m) => m.numeroId))];
        return ids.map((numeroId) => ({ numeroId }));
      },
      upsert: async ({ where, create, update }: { where: Linha; create: Linha; update: Linha }) => {
        const { numeroId, dia } = where.numeroId_dia;
        const atual = estado.metricas.find((r) => r.numeroId === numeroId && r.dia.getTime() === dia.getTime());
        if (atual) Object.assign(atual, update);
        else estado.metricas.push({ ...create });
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("./configuracao", async () => {
  const { REGRAS_PADRAO } = await import("../esquemas/regras-atendimento");
  return { obterRegrasAtendimento: async () => REGRAS_PADRAO };
});

import { recalcularMetricas } from "./metricas";

// Quarta 18/11/2026, 12h em São Paulo.
const agora = new Date("2026-11-18T15:00:00Z");
const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);

function numero(id: string, time: string, dados: Linha = {}) {
  banco.estado.numeros.push({ id, time, excluidoEm: null, ...dados });
}
function conversa(id: string, numeroId: string, dados: Linha = {}) {
  banco.estado.conversas.push({ id, numeroId, tipo: "individual", categoria: "lead", ...dados });
}
function msg(conversaId: string, deMim: boolean, em: string) {
  banco.estado.mensagens.push({ id: `m${banco.estado.mensagens.length}`, conversaId, deMim, enviadaEm: new Date(em) });
}

describe("recalcularMetricas", () => {
  beforeEach(() => {
    banco.estado.numeros = [];
    banco.estado.conversas = [];
    banco.estado.mensagens = [];
    banco.estado.metricas = [];
    banco.estado.consultasMensagens = [];
  });

  it("tabela vazia recalcula 35 dias", async () => {
    numero("n1", "atendimento");
    const r = await recalcularMetricas(agora);
    expect(r).toEqual({ dias: 35, linhas: 35 });
    const dias = banco.estado.metricas.map((m) => m.dia.toISOString().slice(0, 10)).sort();
    expect(dias[0]).toBe("2026-10-15");
    expect(dias[34]).toBe("2026-11-18");
  });

  it("com linhas recalcula 5 dias", async () => {
    numero("n1", "atendimento");
    banco.estado.metricas.push({ numeroId: "n1", dia: dia("2026-11-10"), time: "atendimento" });
    const r = await recalcularMetricas(agora);
    expect(r).toEqual({ dias: 5, linhas: 5 });
    const dias = banco.estado.metricas.map((m) => m.dia.toISOString().slice(0, 10)).sort();
    expect(dias).toEqual(["2026-11-10", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
  });

  it("número sem linhas ganha 35 dias e número com linhas ganha 5", async () => {
    numero("n1", "comercial");
    numero("n2", "comercial");
    conversa("c2", "n2");
    msg("c2", false, "2026-10-16T13:00:00Z"); // sexta 16/10 10h em SP: só a carga de 35 dias pega
    msg("c2", true, "2026-10-16T13:05:00Z");
    banco.estado.metricas.push({ numeroId: "n1", dia: dia("2026-11-10"), time: "comercial" });
    const r = await recalcularMetricas(agora);
    expect(r).toEqual({ dias: 35, linhas: 5 + 35 });
    const diasDe = (id: string) =>
      banco.estado.metricas
        .filter((m) => m.numeroId === id)
        .map((m) => m.dia.toISOString().slice(0, 10))
        .sort();
    expect(diasDe("n1")).toEqual(["2026-11-10", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(diasDe("n2")).toHaveLength(35);
    expect(diasDe("n2")[0]).toBe("2026-10-15");
    const linha = banco.estado.metricas.find((m) => m.numeroId === "n2" && m.dia.getTime() === dia("2026-10-16").getTime())!;
    expect(linha).toMatchObject({ primeirasRespostasSeg: [300] });
    // Mensagens carregadas uma vez, desde o dia mais antigo necessário (7 dias antes de 15/10).
    expect(banco.estado.consultasMensagens).toHaveLength(1);
    expect(banco.estado.consultasMensagens[0].where.enviadaEm.gte).toEqual(new Date("2026-10-08T03:00:00.000Z"));
  });

  it("grava linha com zeros para número sem conversa", async () => {
    numero("n1", "cs");
    await recalcularMetricas(agora);
    const hoje = banco.estado.metricas.find((m) => m.dia.getTime() === dia("2026-11-18").getTime())!;
    expect(hoje).toMatchObject({
      numeroId: "n1",
      time: "cs",
      conversasComCliente: 0,
      primeirasRespostasSeg: [],
      respostasSeg: [],
      respostasNoSla: 0,
      semResposta: 0,
      followupsFeitos: 0,
      followupsPerdidos: 0,
    });
  });

  it("calcula a linha do dia a partir das mensagens do número", async () => {
    numero("n1", "atendimento");
    conversa("c1", "n1");
    msg("c1", false, "2026-11-17T13:00:00Z"); // terça 10h em SP
    msg("c1", true, "2026-11-17T13:05:00Z");
    await recalcularMetricas(agora);
    const linha = banco.estado.metricas.find((m) => m.dia.getTime() === dia("2026-11-17").getTime())!;
    expect(linha).toMatchObject({ conversasComCliente: 1, primeirasRespostasSeg: [300], respostasSeg: [300], respostasNoSla: 1 });
  });

  it("ignora conversa de categoria equipe e grupos", async () => {
    numero("n1", "atendimento");
    conversa("equipe", "n1", { categoria: "equipe" });
    conversa("grupo", "n1", { tipo: "grupo", categoria: "lead" });
    for (const id of ["equipe", "grupo"]) {
      msg(id, false, "2026-11-17T13:00:00Z");
      msg(id, true, "2026-11-17T13:05:00Z");
    }
    await recalcularMetricas(agora);
    expect(banco.estado.metricas.every((m) => m.conversasComCliente === 0)).toBe(true);
  });

  it("não grava linha para número excluído", async () => {
    numero("n1", "atendimento", { excluidoEm: new Date("2026-11-01T00:00:00Z") });
    const r = await recalcularMetricas(agora);
    expect(r.linhas).toBe(0);
  });

  it("linha de ontem mantém o time antigo depois que o número mudou de time; linha de hoje recebe o novo", async () => {
    numero("n1", "cs");
    banco.estado.metricas.push(
      { numeroId: "n1", dia: dia("2026-11-17"), time: "atendimento" },
      { numeroId: "n1", dia: dia("2026-11-18"), time: "atendimento" },
    );
    await recalcularMetricas(agora);
    const por = (d: string) => banco.estado.metricas.find((m) => m.dia.getTime() === dia(d).getTime())!;
    expect(por("2026-11-17").time).toBe("atendimento");
    expect(por("2026-11-18").time).toBe("cs");
    expect(por("2026-11-16").time).toBe("cs"); // linha nova recebe o time atual
  });

  it("consulta de mensagens não pede o campo texto", async () => {
    numero("n1", "atendimento");
    conversa("c1", "n1");
    msg("c1", false, "2026-11-17T13:00:00Z");
    await recalcularMetricas(agora);
    const consulta = banco.estado.consultasMensagens[0];
    expect(consulta.select).toEqual({ conversaId: true, deMim: true, enviadaEm: true });
    expect(consulta.select).not.toHaveProperty("texto");
    expect(consulta.orderBy).toEqual([{ enviadaEm: "asc" }, { id: "asc" }]);
  });
});
