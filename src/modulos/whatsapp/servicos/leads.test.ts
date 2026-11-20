import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = { avaliacoes: [] as Record<string, any>[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const casa = (l: Linha, where: Linha): boolean => {
    for (const [campo, cond] of Object.entries(where ?? {})) {
      const v = l[campo];
      if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Linha;
        if ("in" in c && !c.in.includes(v)) return false;
      } else if (v instanceof Date && cond instanceof Date) {
        if (v.getTime() !== cond.getTime()) return false;
      } else if (v !== cond) return false;
    }
    return true;
  };
  const prisma = {
    avaliacaoConversa: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.avaliacoes.filter((a) => casa(a, where)).map((a) => ({ ...a }));
      },
      count: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.avaliacoes.filter((a) => casa(a, where)).length;
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("./lote-ia", () => ({ ERRO_LIMITE_MENSAL: "Limite mensal de IA do WhatsApp atingido." }));

import { ERRO_LIMITE_MENSAL } from "./lote-ia";
import { listarLeads } from "./leads";

const dia = new Date("2026-11-18T00:00:00.000Z");
const gestor = { id: "g1", papel: "gestor" } as UsuarioAtual;
const comercial = { id: "u1", papel: "comercial" } as UsuarioAtual;

let seq = 0;
const aval = (extra: Linha = {}) => {
  const id = `a${++seq}`;
  banco.estado.avaliacoes.push({
    id, conversaId: `c${id}`, numeroId: "n1", dia, time: "comercial", situacao: "pronto", erro: null,
    situacaoLead: "interessado", temperatura: "morno", motivoTemperatura: "m", oQueRespondeu: "r", proximoPasso: "p",
    criterios: [], notaGeralDecimos: 50, venda: null,
    conversa: { nome: "Conversa", contato: { nomeExibido: "Maria" } }, numero: { nome: "Linha 1" },
    ...extra,
  });
  return id;
};

beforeEach(() => {
  seq = 0;
  banco.estado.avaliacoes = [];
});

describe("listarLeads", () => {
  it("devolve vendas do dia, quentes primeiro e pela menor nota, sem CS", async () => {
    aval({ temperatura: "frio", notaGeralDecimos: 20 });
    aval({ temperatura: "quente", notaGeralDecimos: 80 });
    aval({ temperatura: "quente", notaGeralDecimos: 30 });
    aval({ temperatura: "morno", notaGeralDecimos: 10, time: "paciente_modelo" });
    aval({ temperatura: "quente", time: "cs" });
    const r = await listarLeads(gestor, dia, {});
    expect(r.itens.map((i) => [i.temperatura, i.notaGeralDecimos])).toEqual([
      ["quente", 30], ["quente", 80], ["morno", 10], ["frio", 20],
    ]);
    expect(r.itens[0]!.contatoNome).toBe("Maria");
  });

  it("nome cai para o da conversa e depois para Sem nome", async () => {
    aval({ conversa: { nome: "Conv", contato: { nomeExibido: null } } });
    aval({ conversa: { nome: null, contato: null } });
    const r = await listarLeads(gestor, dia, {});
    expect(r.itens.map((i) => i.contatoNome).sort()).toEqual(["Conv", "Sem nome"]);
  });

  it("filtra por temperatura", async () => {
    aval({ temperatura: "frio" });
    aval({ temperatura: "quente" });
    const r = await listarLeads(gestor, dia, { temperatura: "frio" });
    expect(r.itens.map((i) => i.temperatura)).toEqual(["frio"]);
  });

  it("vendedor recebe ErroPermissao", async () => {
    await expect(listarLeads(comercial, dia, {})).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("conta sem verba, falhas e pendentes", async () => {
    aval({ situacao: "falhou", erro: ERRO_LIMITE_MENSAL });
    aval({ situacao: "falhou", erro: "outro" });
    aval({ situacao: "pendente" });
    aval({ situacao: "falhou", erro: ERRO_LIMITE_MENSAL, time: "cs" });
    const r = await listarLeads(gestor, dia, {});
    expect(r.semVerba).toBe(1);
    expect(r.falhas).toBe(1);
    expect(r.pendentes).toBe(1);
    expect(r.itens).toHaveLength(0);
  });
});
