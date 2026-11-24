import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = {
    avisos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    envios: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    eventos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    auditorias: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    seq: 0,
    forcarCorrida: false,
  };
  const com = (a: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    ...a,
    envios: estado.envios.filter((e) => e.avisoId === a.id).map((e) => ({ ...e, conversa: estado.conversas.find((c) => c.id === e.conversaId) })),
    evento: estado.eventos.find((e) => e.id === a.eventoId) ?? null,
    _count: { envios: estado.envios.filter((e) => e.avisoId === a.id).length },
  });
  const prisma = {
    avisoGrupo: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const a = estado.avisos.find((x) => x.id === where.id);
        return a ? com(a) : null;
      },
      findMany: async ({ where }: { where: { situacao?: string; agendadoPara: { gte: Date; lte: Date } } }) =>
        estado.avisos
          .filter((a) => (!where.situacao || a.situacao === where.situacao) && a.agendadoPara >= where.agendadoPara.gte && a.agendadoPara <= where.agendadoPara.lte)
          .sort((x, y) => x.agendadoPara - y.agendadoPara)
          .map(com),
      create: async ({ data }: { data: Linha }) => {
        const a = { id: `a${++estado.seq}`, situacao: "rascunho", eventoId: null, retratoEvento: null, aprovadoPorId: null, aprovadoEm: null, ...data };
        estado.avisos.push(a);
        return a;
      },
      updateMany: async ({ where, data }: { where: { id: string; situacao: string | { in: string[] } }; data: Linha }) => {
        if (estado.forcarCorrida) return { count: 0 };
        const a = estado.avisos.find((x) => x.id === where.id);
        const ok = typeof where.situacao === "string" ? a?.situacao === where.situacao : where.situacao.in.includes(a?.situacao);
        if (!a || !ok) return { count: 0 };
        Object.assign(a, data);
        return { count: 1 };
      },
    },
    envioAvisoGrupo: {
      deleteMany: async ({ where }: { where: { avisoId: string } }) => {
        estado.envios = estado.envios.filter((e) => e.avisoId !== where.avisoId);
      },
      createMany: async ({ data }: { data: Linha[] }) => {
        for (const d of data) estado.envios.push({ id: `e${++estado.seq}`, situacao: "aguardando", erro: null, ...d });
      },
      updateMany: async ({ where, data }: { where: { avisoId: string }; data: Linha }) => {
        for (const e of estado.envios.filter((x) => x.avisoId === where.avisoId)) Object.assign(e, data);
      },
    },
    conversaWhatsapp: {
      findMany: async ({ where }: { where: { id?: { in: string[] } } }) =>
        estado.conversas.filter((c) => c.tipo === "grupo" && c.monitorada && (!where.id || where.id.in.includes(c.id))).sort((a, b) => a.nome.localeCompare(b.nome)),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
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

const { aprovarAviso, aprovarTodos, cancelarAviso, listarAvisos, listarGruposParaAviso, salvarAviso } = await import("./avisos");

const gestor = { id: "g1", papel: "gestor" } as UsuarioAtual;
const comercial = { id: "u1", papel: "comercial" } as UsuarioAtual;

const as9h = new Date("2026-12-01T12:00:00.000Z"); // 9h em São Paulo
const as7h = new Date("2026-12-01T10:00:00.000Z");

function aviso(id: string, extra: Linha = {}) {
  banco.estado.avisos.push({
    id, texto: "Oi", agendadoPara: as9h, situacao: "rascunho", origem: "avulso", eventoId: null, retratoEvento: null,
    aprovadoPorId: null, aprovadoEm: null, alerta: null, textoPorIa: false, ...extra,
  });
}
const envio = (avisoId: string, conversaId: string) =>
  banco.estado.envios.push({ id: `x${avisoId}${conversaId}`, avisoId, conversaId, situacao: "aguardando", erro: null });

beforeEach(() => {
  const e = banco.estado;
  e.avisos = []; e.envios = []; e.eventos = []; e.auditorias = []; e.seq = 0; e.forcarCorrida = false;
  e.conversas = [
    { id: "c1", nome: "Turma B", tipo: "grupo", monitorada: true },
    { id: "c2", nome: "Turma A", tipo: "grupo", monitorada: true },
    { id: "c3", nome: "Fora", tipo: "grupo", monitorada: false },
    { id: "c4", nome: "Pessoa", tipo: "individual", monitorada: true },
  ];
});

describe("permissão", () => {
  it("comercial não passa em nenhuma", async () => {
    const dados = { texto: "x", agendadoPara: "2026-12-01T09:00", grupos: ["c1"] };
    await expect(listarAvisos(comercial, as7h, as9h)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(listarGruposParaAviso(comercial)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(salvarAviso(comercial, dados)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(aprovarAviso(comercial, "a1")).rejects.toBeInstanceOf(ErroPermissao);
    await expect(aprovarTodos(comercial, as7h, as9h)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(cancelarAviso(comercial, "a1")).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe("listarGruposParaAviso", () => {
  it("só grupos monitorados, por nome", async () => {
    expect(await listarGruposParaAviso(gestor)).toEqual([{ id: "c2", nome: "Turma A" }, { id: "c1", nome: "Turma B" }]);
  });
});

describe("salvarAviso", () => {
  it("cria avulso com os grupos e audita sem o texto", async () => {
    const { id } = await salvarAviso(gestor, { texto: " Olá ", agendadoPara: "2026-12-01T09:00", grupos: ["c1", "c2"] });
    const a = banco.estado.avisos.find((x) => x.id === id)!;
    expect(a.texto).toBe("Olá");
    expect(a.origem).toBe("avulso");
    expect(a.agendadoPara.toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(banco.estado.envios).toHaveLength(2);
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.aviso.criar", diff: { grupos: 2 } });
    expect(JSON.stringify(banco.estado.auditorias)).not.toContain("Olá");
  });

  it("editar um aprovado devolve a rascunho e troca os grupos", async () => {
    aviso("a1", { situacao: "aprovado", aprovadoPorId: "g1", aprovadoEm: new Date(), retratoEvento: { titulo: "x" } });
    envio("a1", "c1");
    await salvarAviso(gestor, { id: "a1", texto: "Novo", agendadoPara: "2026-12-01T09:00", grupos: ["c2"] });
    const a = banco.estado.avisos[0]!;
    expect(a).toMatchObject({ situacao: "rascunho", aprovadoPorId: null, aprovadoEm: null, retratoEvento: Prisma.DbNull, texto: "Novo" });
    expect(banco.estado.envios.map((e) => e.conversaId)).toEqual(["c2"]);
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.aviso.editar" });
  });

  it("recusa editar aviso enviando e grupo fora da lista", async () => {
    aviso("a1", { situacao: "enviando" });
    await expect(salvarAviso(gestor, { id: "a1", texto: "x", agendadoPara: "2026-12-01T09:00", grupos: ["c1"] })).rejects.toBeInstanceOf(ErroNegocio);
    await expect(salvarAviso(gestor, { texto: "x", agendadoPara: "2026-12-01T09:00", grupos: ["c3"] })).rejects.toBeInstanceOf(ErroNegocio);
  });
});

describe("aprovarAviso", () => {
  it("aprova e grava o retrato do evento", async () => {
    banco.estado.eventos.push({ id: "ev1", titulo: "Aula", dataInicio: new Date("2026-12-02T00:00:00.000Z"), horaInicio: "19:00", local: "Sala 1" });
    aviso("a1", { eventoId: "ev1", origem: "agenda" });
    envio("a1", "c1");
    await aprovarAviso(gestor, "a1");
    expect(banco.estado.avisos[0]).toMatchObject({
      situacao: "aprovado",
      aprovadoPorId: "g1",
      retratoEvento: { titulo: "Aula", dataInicio: "2026-12-02T00:00:00.000Z", horaInicio: "19:00", local: "Sala 1" },
    });
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.aviso.aprovar", diff: { grupos: 1 } });
  });

  it("às 7h de São Paulo recusa citando 8h", async () => {
    aviso("a1", { agendadoPara: as7h });
    envio("a1", "c1");
    await expect(aprovarAviso(gestor, "a1")).rejects.toThrow(/8h/);
  });

  it("recusa aviso que não é rascunho", async () => {
    aviso("a1", { situacao: "enviando" });
    envio("a1", "c1");
    await expect(aprovarAviso(gestor, "a1")).rejects.toBeInstanceOf(ErroNegocio);
  });

  it("corrida: updateMany sem linha dá erro de aviso mudou", async () => {
    aviso("a1");
    envio("a1", "c1");
    banco.estado.forcarCorrida = true;
    await expect(aprovarAviso(gestor, "a1")).rejects.toThrow("Este aviso já mudou. Atualize a página.");
  });
});

describe("aprovarTodos", () => {
  it("aprova o válido e recusa o sem grupos com o motivo", async () => {
    aviso("a1");
    envio("a1", "c1");
    aviso("a2");
    const r = await aprovarTodos(gestor, as7h, new Date("2026-12-02T00:00:00.000Z"));
    expect(r.aprovados).toBe(1);
    expect(r.recusados).toEqual([{ id: "a2", motivo: "Escolha ao menos um grupo." }]);
  });
});

describe("cancelarAviso", () => {
  it("cancela e marca os envios", async () => {
    aviso("a1", { situacao: "aprovado" });
    envio("a1", "c1");
    await cancelarAviso(gestor, "a1");
    expect(banco.estado.avisos[0]!.situacao).toBe("cancelado");
    expect(banco.estado.envios[0]!.situacao).toBe("cancelado");
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.aviso.cancelar" });
  });

  it("recusa aviso concluído", async () => {
    aviso("a1", { situacao: "concluido" });
    await expect(cancelarAviso(gestor, "a1")).rejects.toBeInstanceOf(ErroNegocio);
  });
});

describe("listarAvisos", () => {
  it("rascunhos antes, depois por horário", async () => {
    aviso("a1", { situacao: "aprovado", agendadoPara: new Date("2026-12-01T11:00:00.000Z") });
    aviso("a2", { agendadoPara: new Date("2026-12-01T15:00:00.000Z") });
    envio("a2", "c1");
    const r = await listarAvisos(gestor, as7h, new Date("2026-12-02T00:00:00.000Z"));
    expect(r.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(r[0]!.grupos[0]).toMatchObject({ conversaId: "c1", nome: "Turma B" });
  });
});
