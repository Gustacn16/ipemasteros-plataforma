import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    vendas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    contatos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    consultas: [] as string[],
  };
  // Como no mock de saude.test.ts: o LIKE do MySQL da Hostinger não pode ser usado.
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  // Avalia o subconjunto de filtros do Prisma que o serviço usa.
  const casa = (linha: Linha, where: Linha | undefined, relacoes: Record<string, (l: Linha) => Linha | null> = {}): boolean => {
    for (const [campo, cond] of Object.entries(where ?? {})) {
      if (campo in relacoes) {
        const rel = relacoes[campo]!(linha);
        if (!rel || !casa(rel, cond as Linha)) return false;
        continue;
      }
      const v = linha[campo];
      if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Linha;
        if ("in" in c && !c.in.includes(v)) return false;
        if ("gte" in c && !(v >= c.gte)) return false;
        if ("lt" in c && !(v < c.lt)) return false;
        if ("not" in c && v === c.not) return false;
      } else if (v instanceof Date && cond instanceof Date) {
        if (v.getTime() !== cond.getTime()) return false;
      } else if (v !== cond) return false;
    }
    return true;
  };
  const numeroDe = (id: string | null) => estado.numeros.find((n) => n.id === id) ?? null;
  const conversaDe = (id: string) => estado.conversas.find((c) => c.id === id) ?? null;
  const prisma = {
    numeroWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        estado.consultas.push("numeros");
        return estado.numeros.filter((n) => casa(n, where)).map((n) => ({ ...n }));
      },
    },
    venda: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        estado.consultas.push("vendas");
        return estado.vendas.filter((v) => casa(v, where)).map((v) => ({ ...v, produto: { nome: v.produtoNome } }));
      },
    },
    contatoWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        estado.consultas.push("contatos");
        return estado.contatos.filter((c) => casa(c, where)).map((c) => ({ ...c }));
      },
    },
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        estado.consultas.push("conversas");
        return estado.conversas
          .filter((c) => casa(c, where, { numero: (l) => numeroDe(l.numeroId) }))
          .sort((a, b) => (b.ultimaMensagemEm?.getTime() ?? 0) - (a.ultimaMensagemEm?.getTime() ?? 0))
          .map((c) => ({ ...c }));
      },
    },
    mensagemWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        estado.consultas.push("mensagens");
        const relConversa = (l: Linha) => conversaDe(l.conversaId);
        const { conversa: filtroConversa, ...resto } = where;
        return estado.mensagens
          .filter((m) => casa(m, resto) && (!filtroConversa || casa(relConversa(m)!, filtroConversa, { numero: (c) => numeroDe(c.numeroId) })))
          .sort((a, b) => a.enviadaEm.getTime() - b.enviadaEm.getTime() || a.id.localeCompare(b.id))
          .map((m) => ({ ...m, conversa: { contatoId: conversaDe(m.conversaId)!.contatoId } }));
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

import { evolucaoCs, listarVendasCs } from "./cs";

const agora = new Date("2026-11-18T12:00:00Z");
const h = (horas: number) => new Date(agora.getTime() - horas * 3_600_000);
const inicio = new Date("2026-11-01T03:00:00Z");
const fim = new Date("2026-11-19T03:00:00Z");
const gestor = { id: "g1", papel: "gestor" } as UsuarioAtual;
const comercial = { id: "u1", papel: "comercial" } as UsuarioAtual;

let seq = 0;
const venda = (id: string, criadoEm: Date, whatsappCliente: string | null, extra: Linha = {}) =>
  banco.estado.vendas.push({ id, nomeCliente: `Cliente ${id}`, produtoNome: "Curso", whatsappCliente, criadoEm, excluidoEm: null, ...extra });
const msg = (conversaId: string, enviadaEm: Date, deMim = true) =>
  banco.estado.mensagens.push({ id: `m${String(++seq).padStart(4, "0")}`, conversaId, deMim, enviadaEm });

beforeEach(() => {
  seq = 0;
  banco.estado.numeros = [
    { id: "cs1", time: "cs", timeDesde: h(24 * 15), excluidoEm: null },
    { id: "pm1", time: "paciente_modelo", timeDesde: null, excluidoEm: null },
  ];
  banco.estado.vendas = [];
  banco.estado.contatos = [{ id: "k1", telefone: "5511999887766" }];
  banco.estado.conversas = [
    { id: "c-cs", tipo: "individual", numeroId: "cs1", contatoId: "k1", ultimaMensagemEm: h(1) },
    { id: "c-pm", tipo: "individual", numeroId: "pm1", contatoId: "k1", ultimaMensagemEm: h(0.5) },
  ];
  banco.estado.mensagens = [];
  banco.estado.consultas = [];
});

describe("listarVendasCs", () => {
  it('venda "1199887766" acha contato "5511999887766"', async () => {
    venda("v1", h(5), "1199887766");
    msg("c-cs", h(4));
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.semNumeroCs).toBe(false);
    expect(r.vendas).toHaveLength(1);
    expect(r.vendas[0]).toMatchObject({
      id: "v1",
      produto: "Curso",
      cliente: "Cliente v1",
      situacao: "contatada",
      primeiroContatoEm: h(4),
      segundos: 3600,
      conversaId: "c-cs",
    });
    expect(r.medianaSeg).toBe(3600);
    expect(r.aguardando).toBe(0);
  });

  it("CS que falou antes da venda: vale a primeira mensagem depois", async () => {
    venda("v1", h(5), "11999887766");
    msg("c-cs", h(6));
    msg("c-cs", h(3));
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.vendas[0]).toMatchObject({ situacao: "contatada", segundos: 7200, primeiroContatoEm: h(3) });
  });

  it("venda criada antes do timeDesde da CS fica de fora", async () => {
    venda("antiga", h(24 * 16), "11999887766");
    venda("nova", h(24 * 2), "11999887766");
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.vendas.map((v) => v.id)).toEqual(["nova"]);
  });

  it("venda excluída fica de fora", async () => {
    venda("v1", h(5), "11999887766", { excluidoEm: h(1) });
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.vendas).toEqual([]);
  });

  it("mensagem de número paciente_modelo não conta como contato da CS", async () => {
    venda("v1", h(5), "11999887766");
    msg("c-pm", h(4));
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.vendas[0]).toMatchObject({ situacao: "aguardando", segundos: 5 * 3600, primeiroContatoEm: null, conversaId: "c-cs" });
    expect(r.medianaSeg).toBeNull();
    expect(r.aguardando).toBe(1);
  });

  it("mensagem do cliente (não deMim) não conta", async () => {
    venda("v1", h(5), "11999887766");
    msg("c-cs", h(4), false);
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.vendas[0]!.situacao).toBe("aguardando");
  });

  it("aguardando vêm primeiro", async () => {
    banco.estado.contatos.push({ id: "k2", telefone: "5521988776655" });
    banco.estado.conversas.push({ id: "c-cs2", tipo: "individual", numeroId: "cs1", contatoId: "k2", ultimaMensagemEm: h(1) });
    venda("contatada-recente", h(2), "11999887766");
    msg("c-cs", h(1));
    venda("aguardando-novo", h(10), "21988776655");
    venda("aguardando-velho", h(30), "21988776655");
    venda("sem-whats", h(1), null);
    venda("sem-contato", h(24 * 9), "31977665544");
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.vendas.map((v) => [v.id, v.situacao])).toEqual([
      ["aguardando-velho", "aguardando"],
      ["aguardando-novo", "aguardando"],
      ["sem-whats", "sem_whatsapp"],
      ["contatada-recente", "contatada"],
      ["sem-contato", "sem_contato"],
    ]);
    expect(r.aguardando).toBe(2);
    expect(r.medianaSeg).toBe(3600);
    expect(r.vendas.find((v) => v.id === "sem-whats")!.conversaId).toBeNull();
  });

  it("sem número cs → semNumeroCs true", async () => {
    banco.estado.numeros = [{ id: "pm1", time: "paciente_modelo", timeDesde: null, excluidoEm: null }];
    venda("v1", h(5), "11999887766");
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r).toEqual({ semNumeroCs: true, vendas: [], medianaSeg: null, aguardando: 0 });
  });

  it("número cs excluído não conta", async () => {
    banco.estado.numeros[0]!.excluidoEm = h(1);
    const r = await listarVendasCs(gestor, inicio, fim, agora);
    expect(r.semNumeroCs).toBe(true);
  });

  it("comercial lança ErroPermissao", async () => {
    await expect(listarVendasCs(comercial, inicio, fim, agora)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(evolucaoCs(comercial, [], agora)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("nenhuma consulta usa LIKE e não há consulta por venda", async () => {
    for (let i = 0; i < 5; i++) venda(`v${i}`, h(5 + i), "11999887766");
    msg("c-cs", h(4));
    await listarVendasCs(gestor, inicio, fim, agora);
    expect(banco.estado.consultas.length).toBeLessThanOrEqual(5);
    expect(new Set(banco.estado.consultas).size).toBe(banco.estado.consultas.length);
  });
});

describe("evolucaoCs", () => {
  it("mediana e vendas de cada semana", async () => {
    const s1 = { inicio: h(24 * 14), fim: h(24 * 7), rotulo: "S1" };
    const s2 = { inicio: h(24 * 7), fim: agora, rotulo: "S2" };
    venda("a", h(24 * 10), "11999887766");
    msg("c-cs", new Date(h(24 * 10).getTime() + 600_000));
    venda("b", h(24 * 3), "11999887766");
    msg("c-cs", new Date(h(24 * 3).getTime() + 1200_000));
    venda("c", h(24 * 2), null);
    const r = await evolucaoCs(gestor, [s1, s2], agora);
    expect(r).toEqual([
      { rotulo: "S1", medianaSeg: 600, vendas: 1 },
      { rotulo: "S2", medianaSeg: 1200, vendas: 2 },
    ]);
  });

  it("sem número cs → semanas com mediana null e 0 vendas", async () => {
    banco.estado.numeros = [];
    const r = await evolucaoCs(gestor, [{ inicio: h(48), fim: agora, rotulo: "S" }], agora);
    expect(r).toEqual([{ rotulo: "S", medianaSeg: null, vendas: 0 }]);
  });
});
