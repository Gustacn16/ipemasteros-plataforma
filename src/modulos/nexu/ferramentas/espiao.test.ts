import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  concorrente: { findMany: vi.fn() },
  midiaConcorrente: { findMany: vi.fn() },
  sinalEspiao: { findMany: vi.fn() },
  lerPagina: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { concorrente: m.concorrente, midiaConcorrente: m.midiaConcorrente, sinalEspiao: m.sinalEspiao } }));
vi.mock("@/modulos/espiao/fontes/pagina", () => ({ lerPagina: m.lerPagina }));
const { ferramentaEspiaoBuscarConteudo, ferramentaEspiaoPaginaAgora, ferramentaEspiaoSinais } = await import("./espiao");
const { ferramentasDoPapel } = await import("./registro");

const comercial = { id: "v1", papel: "comercial" } as never;
const ctx = { conversaId: "c", toolUseId: "t" };
const espiao = (papel: Parameters<typeof ferramentasDoPapel>[0]) => ferramentasDoPapel(papel).filter((f) => f.nome.startsWith("espiao_")).map((f) => f.nome);

/** Procura `contains`/`startsWith`/`endsWith` em qualquer nível do objeto (proibidos no MySQL da Hostinger). */
const temLike = (o: unknown): boolean =>
  typeof o === "object" && o !== null && Object.entries(o).some(([k, v]) => ["contains", "startsWith", "endsWith"].includes(k) || temLike(v));

beforeEach(() => {
  vi.clearAllMocks();
  m.concorrente.findMany.mockResolvedValue([{ id: "k1", nome: "Concorrente X", instagram: "concx" }]);
});

describe("ferramentas do espião no Nexu", () => {
  it("colaborador não recebe nenhuma; comercial recebe as 5", () => {
    expect(espiao("colaborador")).toEqual([]);
    expect(espiao("comercial")).toEqual(["espiao_sinais", "espiao_concorrente", "espiao_buscar_conteudo", "espiao_perfil_agora", "espiao_pagina_agora"]);
  });

  it("buscar_conteudo acha 'residência' com o termo sem acento e não usa LIKE no banco", async () => {
    m.midiaConcorrente.findMany.mockResolvedValue([
      { concorrenteId: "k1", permalink: "https://ig/1", publicadoEm: new Date("2026-11-10T00:00:00Z"), legenda: "Aprovação na Residência médica!", transcricao: null, resumo: null },
      { concorrenteId: "k1", permalink: "https://ig/2", publicadoEm: new Date("2026-11-09T00:00:00Z"), legenda: "Outro tema", transcricao: "nada aqui", resumo: null },
    ]);
    const r = (await ferramentaEspiaoBuscarConteudo.executar(comercial, { termo: "residencia" }, ctx)) as { itens: { link: string; trecho: string }[]; total: number };
    expect(r.total).toBe(1);
    expect(r.itens[0].link).toBe("https://ig/1");
    expect(r.itens[0].trecho).toContain("Residência");
    expect(temLike(m.midiaConcorrente.findMany.mock.calls[0][0])).toBe(false);
  });

  it("pagina_agora corta em 20000 caracteres e marca como externa", async () => {
    m.lerPagina.mockResolvedValue({ urlFinal: "https://x.com/", texto: "a".repeat(30_000), legivel: true, precos: ["R$ 1,00"] });
    const r = (await ferramentaEspiaoPaginaAgora.executar(comercial, { url: "https://x.com/" }, ctx)) as { fonte: string; texto: string; precos: string[] };
    expect(r.fonte).toBe("externa_nao_confiavel");
    expect(r.texto).toHaveLength(20_000);
    expect(r.precos).toEqual(["R$ 1,00"]);
  });

  it("sinais filtra pelo concorrente resolvido no código", async () => {
    m.sinalEspiao.findMany.mockResolvedValue([]);
    await ferramentaEspiaoSinais.executar(comercial, { concorrente: "concorrente x" }, ctx);
    const where = m.sinalEspiao.findMany.mock.calls[0][0].where;
    expect(where.concorrenteId).toBe("k1");
    expect(temLike(m.sinalEspiao.findMany.mock.calls[0][0])).toBe(false);
  });
});
