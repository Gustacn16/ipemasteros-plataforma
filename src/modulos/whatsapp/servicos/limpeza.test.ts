import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que a limpeza usa.
const banco = vi.hoisted(() => {
  const estado = {
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    contatos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    alunos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    usuarios: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    resumos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  // Como no mock de captura.test.ts: o LIKE do MySQL da Hostinger não pode ser usado.
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const dataLt = (v: Date | null, lt: Date) => v !== null && v < lt;
  // Conversa individual vazia: relação `mensagens: { none: {} }` e OR de datas.
  const conversaCombina = (c: Linha, where: Linha) => {
    semLike(where);
    if (where.tipo !== undefined && c.tipo !== where.tipo) return false;
    if (where.categoria?.not !== undefined && c.categoria === where.categoria.not) return false;
    if (where.contatoId !== undefined && c.contatoId !== where.contatoId) return false;
    if (where.categoria !== undefined && typeof where.categoria === "string" && c.categoria !== where.categoria) return false;
    if (where.mensagens?.none && estado.mensagens.some((m) => m.conversaId === c.id)) return false;
    if (where.OR) {
      const ok = where.OR.some((o: Linha) => {
        if (o.ultimaMensagemEm?.lt) return dataLt(c.ultimaMensagemEm ?? null, o.ultimaMensagemEm.lt);
        if (o.ultimaMensagemEm === null) return (c.ultimaMensagemEm ?? null) === null && dataLt(c.criadoEm ?? null, o.criadoEm.lt);
        return false;
      });
      if (!ok) return false;
    }
    return true;
  };
  const contatoCombina = (c: Linha, where: Linha) => {
    semLike(where);
    if (where.telefone?.not === null && c.telefone == null) return false;
    if (where.alunoId === null && c.alunoId) return false;
    if (where.usuarioId === null && c.usuarioId) return false;
    if (where.id?.gt && !(c.id > where.id.gt)) return false;
    if (where.criadoEm?.lt && !(c.criadoEm < where.criadoEm.lt)) return false;
    if (where.mensagens?.none && estado.mensagens.some((m) => m.contatoId === c.id)) return false;
    if (where.conversas?.none && estado.conversas.some((x) => x.contatoId === c.id)) return false;
    return true;
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
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    resumoGrupo: {
      deleteMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        const antes = estado.resumos.length;
        estado.resumos = estado.resumos.filter((r) => !(r.dia < where.dia.lt));
        return { count: antes - estado.resumos.length };
      },
    },
    aluno: { findMany: async () => estado.alunos },
    usuario: { findMany: async () => estado.usuarios },
    contatoWhatsapp: {
      findMany: async ({ where, take }: { where: Linha; take: number }) =>
        estado.contatos
          .filter((c) => contatoCombina(c, where))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, take)
          .map((c) => ({ id: c.id, telefone: c.telefone })),
      update: async ({ where, data }: { where: { id: string }; data: Linha }) => {
        Object.assign(estado.contatos.find((c) => c.id === where.id)!, data);
      },
      deleteMany: async ({ where }: { where: Linha }) => {
        const antes = estado.contatos.length;
        estado.contatos = estado.contatos.filter((c) => !contatoCombina(c, where));
        return { count: antes - estado.contatos.length };
      },
    },
    conversaWhatsapp: {
      deleteMany: async ({ where }: { where: Linha }) => {
        const apagar = estado.conversas.filter((c) => conversaCombina(c, where));
        estado.conversas = estado.conversas.filter((c) => !apagar.includes(c));
        return { count: apagar.length };
      },
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
      updateMany: async ({ where, data }: { where: Linha; data: Linha }) => {
        const alvo = where.contatoId
          ? estado.conversas.filter((c) => conversaCombina(c, where))
          : estado.conversas.filter(
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

import { esquecerTelefonesCadastrados } from "./captura";
import { limparWhatsapp } from "./limpeza";

const AGORA = new Date("2026-11-17T12:00:00Z");
const horas = (h: number) => new Date(AGORA.getTime() + h * 3600_000);
const dias = (d: number) => horas(d * 24);

function conversa(id: string, dados: Linha) {
  banco.estado.conversas.push({ id, tipo: "grupo", monitorada: false, provisoriaAte: null, ...dados });
}
function individual(id: string, dados: Linha) {
  banco.estado.conversas.push({ id, tipo: "individual", categoria: "lead", contatoId: null, monitorada: false, provisoriaAte: null, ultimaMensagemEm: null, criadoEm: dias(-1), ...dados });
}
function contato(id: string, dados: Linha) {
  banco.estado.contatos.push({ id, telefone: null, alunoId: null, usuarioId: null, criadoEm: dias(-10), ...dados });
}
function mensagem(id: string, conversaId: string, enviadaEm: Date) {
  banco.estado.mensagens.push({ id, conversaId, enviadaEm });
}

describe("limparWhatsapp", () => {
  beforeEach(() => {
    banco.estado.conversas = [];
    banco.estado.mensagens = [];
    banco.estado.contatos = [];
    banco.estado.alunos = [];
    banco.estado.usuarios = [];
    banco.estado.resumos = [];
    esquecerTelefonesCadastrados();
  });

  it("apaga a provisória vencida de grupo não monitorado e zera provisoriaAte", async () => {
    conversa("g1", { provisoriaAte: horas(-1) });
    mensagem("m1", "g1", dias(-3));
    const r = await limparWhatsapp(AGORA);
    expect(r).toMatchObject({ provisorias: 1, antigas: 0 });
    expect(banco.estado.mensagens).toHaveLength(0);
    expect(banco.estado.conversas[0].provisoriaAte).toBeNull();
  });

  it("não apaga de grupo que virou monitorado nem provisória ainda no prazo", async () => {
    conversa("g1", { monitorada: true, provisoriaAte: horas(-1) });
    conversa("g2", { provisoriaAte: horas(5) });
    mensagem("m1", "g1", dias(-3));
    mensagem("m2", "g2", dias(-3));
    const r = await limparWhatsapp(AGORA);
    expect(r).toMatchObject({ provisorias: 0, antigas: 0 });
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
    expect(r).toMatchObject({ provisorias: 0, antigas: 0 });
    expect(banco.estado.mensagens).toHaveLength(1);
    expect(banco.estado.conversas[0].provisoriaAte).toEqual(horas(-1));
    busca.mockRestore();
  });

  it("apaga mensagem de 91 dias e mantém a de 89", async () => {
    conversa("g1", { monitorada: true });
    mensagem("velha", "g1", dias(-91));
    mensagem("nova", "g1", dias(-89));
    const r = await limparWhatsapp(AGORA);
    expect(r).toMatchObject({ provisorias: 0, antigas: 1 });
    expect(banco.estado.mensagens.map((m) => m.id)).toEqual(["nova"]);
  });

  it("apaga em lotes de 5000 até acabar", async () => {
    conversa("g1", { monitorada: true });
    for (let i = 0; i < 5001; i++) mensagem(`m${i}`, "g1", dias(-100));
    const r = await limparWhatsapp(AGORA);
    expect(r.antigas).toBe(5001);
    expect(banco.estado.mensagens).toHaveLength(0);
  });

  it("contato com telefone e sem ligação ganha o aluno cadastrado depois e a conversa 'lead' vira 'aluno'", async () => {
    contato("c1", { telefone: "5511987654321" });
    individual("i1", { contatoId: "c1" });
    mensagem("m1", "i1", dias(-1));
    banco.estado.alunos.push({ id: "a1", telefone: "(11) 98765-4321" });
    const r = await limparWhatsapp(AGORA);
    expect(r.religados).toBe(1);
    expect(banco.estado.contatos[0].alunoId).toBe("a1");
    expect(banco.estado.conversas[0].categoria).toBe("aluno");
  });

  it("conversa com categoria mudada à mão (ex.: 'outro' escolhido pela gestão) não muda ao religar", async () => {
    contato("c1", { telefone: "5511987654321" });
    individual("i1", { contatoId: "c1", categoria: "outro" });
    mensagem("m1", "i1", dias(-1));
    banco.estado.alunos.push({ id: "a1", telefone: "11987654321" });
    const r = await limparWhatsapp(AGORA);
    expect(r.religados).toBe(1);
    expect(banco.estado.contatos[0].alunoId).toBe("a1");
    expect(banco.estado.conversas[0].categoria).toBe("outro");
  });

  it("individual sem mensagens e sem atividade há mais de 90 dias é apagada", async () => {
    individual("velha", { ultimaMensagemEm: dias(-91) });
    individual("sem-data", { criadoEm: dias(-91) });
    individual("recente", { ultimaMensagemEm: dias(-89) });
    individual("nova", { criadoEm: dias(-2) });
    individual("com-msg", { ultimaMensagemEm: dias(-100) });
    mensagem("m1", "com-msg", dias(-5));
    const r = await limparWhatsapp(AGORA);
    expect(r.conversasVazias).toBe(2);
    expect(banco.estado.conversas.map((c) => c.id).sort()).toEqual(["com-msg", "nova", "recente"]);
  });

  it("individual 'pessoal' sem mensagens continua", async () => {
    individual("p1", { categoria: "pessoal", ultimaMensagemEm: dias(-200) });
    const r = await limparWhatsapp(AGORA);
    expect(r.conversasVazias).toBe(0);
    expect(banco.estado.conversas).toHaveLength(1);
  });

  it("grupo sem mensagens continua", async () => {
    conversa("g1", { monitorada: true, ultimaMensagemEm: dias(-200), criadoEm: dias(-200) });
    const r = await limparWhatsapp(AGORA);
    expect(r.conversasVazias).toBe(0);
    expect(banco.estado.conversas).toHaveLength(1);
  });

  it("contato sem mensagens, sem conversas e sem ligação é apagado; com aluno ligado continua", async () => {
    contato("vazio", { telefone: "5511911112222" });
    contato("com-aluno", { telefone: "5511933334444", alunoId: "a9" });
    contato("com-conversa", { telefone: "5511955556666" });
    individual("i1", { contatoId: "com-conversa", categoria: "pessoal" });
    const r = await limparWhatsapp(AGORA);
    expect(r.contatosVazios).toBe(1);
    expect(banco.estado.contatos.map((c) => c.id).sort()).toEqual(["com-aluno", "com-conversa"]);
  });

  it("contato vazio criado há menos de 1 dia continua", async () => {
    contato("novo", { telefone: "5511911112222", criadoEm: horas(-2) });
    contato("velho", { telefone: "5511933334444", criadoEm: horas(-30) });
    const r = await limparWhatsapp(AGORA);
    expect(r.contatosVazios).toBe(1);
    expect(banco.estado.contatos.map((c) => c.id)).toEqual(["novo"]);
  });

  it("a resposta traz religados, conversasVazias e contatosVazios", async () => {
    contato("c1", { telefone: "5511987654321" });
    banco.estado.usuarios.push({ id: "u1", whatsapp: "11987654321" });
    individual("i1", { contatoId: "c1", ultimaMensagemEm: dias(-100) });
    const r = await limparWhatsapp(AGORA);
    expect(r).toEqual({ provisorias: 0, antigas: 0, resumosAntigos: 0, religados: 1, conversasVazias: 1, contatosVazios: 0 });
  });

  it("limpeza apaga resumos com dia anterior a 365 dias e conta resumosAntigos", async () => {
    banco.estado.resumos = [
      { id: "r1", dia: new Date("2025-11-16T00:00:00.000Z") },
      { id: "r2", dia: new Date("2025-11-18T00:00:00.000Z") },
      { id: "r3", dia: new Date("2026-11-16T00:00:00.000Z") },
    ];
    const r = await limparWhatsapp(AGORA);
    expect(r.resumosAntigos).toBe(1);
    expect(banco.estado.resumos.map((x) => x.id)).toEqual(["r2", "r3"]);
  });
});
