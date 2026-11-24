import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const p2002 = () => Object.assign(new Error("único"), { code: "P2002" });
  return {
    p2002,
    prisma: {
      eventoInstitucional: { findMany: vi.fn() },
      avisoGrupo: { findMany: vi.fn(), create: vi.fn() },
      conversaWhatsapp: { findMany: vi.fn() },
      grupoPadraoTipoEvento: { findMany: vi.fn() },
    },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/ia/cliente", () => ({ obterClienteAnthropic: () => null }));
vi.mock("../ia/texto-aviso", () => ({ escreverAviso: async () => ({ texto: "Texto", porIa: true }) }));

import { gerarRascunhosDaSemana } from "./avisos-rascunho";

const segunda10h = new Date("2026-11-30T13:00:00Z"); // segunda 10h em SP
const terca = new Date("2026-12-01T13:00:00Z");
const base = { titulo: "T", descricao: null, local: null, horaInicio: null, dataInicio: new Date("2026-12-07T00:00:00.000Z") };

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.eventoInstitucional.findMany.mockResolvedValue([
    { ...base, id: "e1", tipoId: "t1", turma: "Turma Ávila" },
    { ...base, id: "e2", tipoId: "t2", turma: null },
  ]);
  m.prisma.avisoGrupo.findMany.mockResolvedValue([]);
  m.prisma.avisoGrupo.create.mockResolvedValue({});
  m.prisma.conversaWhatsapp.findMany.mockResolvedValue([
    { id: "g1", turma: { nome: "turma avila" } },
    { id: "g2", turma: { nome: "Turma  ÁVILA" } },
    { id: "g3", turma: { nome: "Outra" } },
  ]);
  m.prisma.grupoPadraoTipoEvento.findMany.mockResolvedValue([{ conversaId: "g9" }]);
});

describe("gerarRascunhosDaSemana", () => {
  it("fora da segunda não consulta nada", async () => {
    expect(await gerarRascunhosDaSemana(terca, null)).toEqual({ criados: 0, jaExistiam: 0 });
    expect(await gerarRascunhosDaSemana(new Date("2026-11-30T09:00:00Z"), null)).toEqual({ criados: 0, jaExistiam: 0 }); // segunda 6h
    expect(m.prisma.eventoInstitucional.findMany).not.toHaveBeenCalled();
  });
  it("cria um aviso por evento com os grupos sugeridos", async () => {
    expect(await gerarRascunhosDaSemana(segunda10h, null)).toEqual({ criados: 2, jaExistiam: 0 });
    const dados = m.prisma.avisoGrupo.create.mock.calls.map((c) => c[0].data);
    expect(dados.map((d) => d.envios.create.map((e: { conversaId: string }) => e.conversaId))).toEqual([["g1", "g2"], ["g9"]]);
    expect(dados[0]).toMatchObject({ eventoId: "e1", origem: "agenda", textoPorIa: true, agendadoPara: new Date("2026-12-06T09:00:00-03:00") });
  });
  it("P2002 conta como já existia", async () => {
    m.prisma.avisoGrupo.create.mockRejectedValue(m.p2002());
    expect(await gerarRascunhosDaSemana(segunda10h, null)).toEqual({ criados: 0, jaExistiam: 2 });
  });
});
