import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => {
  type L = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const estado = { contatos: [] as L[], conversas: [] as L[], mensagens: [] as L[] };
  const auditorias: L[] = [];

  function combina(l: L, where: L | undefined): boolean {
    for (const [k, v] of Object.entries(where ?? {})) {
      if (v !== null && typeof v === "object") {
        if ("endsWith" in v || "contains" in v || "startsWith" in v) throw new Error("LIKE não é permitido");
        if ("in" in v) {
          if (!v.in.includes(l[k])) return false;
          continue;
        }
      }
      if (l[k] !== v) return false;
    }
    return true;
  }
  const tabela = (nome: keyof typeof estado) => ({
    findMany: async ({ where }: { where?: L } = {}) => estado[nome].filter((l) => combina(l, where)).map((l) => ({ ...l })),
    deleteMany: async ({ where }: { where?: L }) => {
      const sai = estado[nome].filter((l) => combina(l, where));
      estado[nome] = estado[nome].filter((l) => !sai.includes(l));
      if (nome === "conversas") estado.mensagens = estado.mensagens.filter((m) => !sai.some((c) => c.id === m.conversaId));
      return { count: sai.length };
    },
    delete: async ({ where }: { where: L }) => {
      estado[nome] = estado[nome].filter((l) => !combina(l, where));
      return {};
    },
  });
  const prisma: L = {
    contatoWhatsapp: tabela("contatos"),
    conversaWhatsapp: tabela("conversas"),
    mensagemWhatsapp: tabela("mensagens"),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma, auditorias };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: async (d: unknown) => {
    banco.auditorias.push(d as Record<string, unknown>);
  },
}));

const { apagarDadosDoTelefone } = await import("./titular");
const { esquemaApagarDadosTelefone } = await import("../esquemas/titular");

beforeEach(() => {
  banco.auditorias.length = 0;
  banco.estado.contatos = [
    { id: "c1", telefone: "556281707432", lid: "1@lid" },
    { id: "c2", telefone: "5562988887777", lid: null },
  ];
  banco.estado.conversas = [
    { id: "i1", tipo: "individual", contatoId: "c1" },
    { id: "i2", tipo: "individual", contatoId: "c2" },
    { id: "g1", tipo: "grupo", contatoId: null },
  ];
  banco.estado.mensagens = [
    { id: "m1", conversaId: "i1", contatoId: "c1" },
    { id: "m2", conversaId: "i1", contatoId: null }, // própria, na conversa individual
    { id: "m3", conversaId: "g1", contatoId: "c1" },
    { id: "m4", conversaId: "g1", contatoId: "c2" },
    { id: "m5", conversaId: "i2", contatoId: "c2" },
  ];
});

describe("apagarDadosDoTelefone", () => {
  it("acha o contato pelo telefone em outro formato e apaga as mensagens dele (também em grupos), as conversas individuais e o contato", async () => {
    const r = await apagarDadosDoTelefone("(62) 98170-7432", "u1");
    expect(r).toEqual({ encontrado: true, mensagens: 3, conversas: 1 });
    expect(banco.estado.contatos.map((c) => c.id)).toEqual(["c2"]);
    expect(banco.estado.conversas.map((c) => c.id).sort()).toEqual(["g1", "i2"]);
    expect(banco.estado.mensagens.map((m) => m.id).sort()).toEqual(["m4", "m5"]);
  });

  it("telefone sem contato devolve encontrado: false e não audita", async () => {
    const r = await apagarDadosDoTelefone("62999990000", "u1");
    expect(r).toEqual({ encontrado: false, mensagens: 0, conversas: 0 });
    expect(banco.auditorias).toHaveLength(0);
    expect(banco.estado.contatos).toHaveLength(2);
  });

  it("audita whatsapp.dados_telefone_apagados só com ids e contagens", async () => {
    await apagarDadosDoTelefone("556281707432", "u1");
    expect(banco.auditorias).toHaveLength(1);
    expect(banco.auditorias[0]).toMatchObject({
      usuarioId: "u1", acao: "whatsapp.dados_telefone_apagados", entidadeId: "c1", diff: { mensagens: 3, conversas: 1 },
    });
    const json = JSON.stringify(banco.auditorias[0]);
    expect(json).not.toContain("81707432");
    expect(json).not.toContain("1@lid");
  });

  it("telefone inválido (menos de 10 dígitos) é recusado pelo esquema", () => {
    expect(esquemaApagarDadosTelefone.safeParse({ telefone: "(62) 9817" }).success).toBe(false);
    expect(esquemaApagarDadosTelefone.safeParse({ telefone: "(62) 98170-7432" }).data).toEqual({ telefone: "62981707432" });
  });
});
