import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

const m = vi.hoisted(() => ({
  listarNumeros: vi.fn(),
  semRespostaAgora: vi.fn(),
  resumoDaSemana: vi.fn(),
  listarLeads: vi.fn(),
  listarVendasCs: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./numeros", () => ({ listarNumeros: m.listarNumeros }));
vi.mock("./painel-atendimento", () => ({ semRespostaAgora: m.semRespostaAgora, resumoDaSemana: m.resumoDaSemana }));
vi.mock("./leads", () => ({ listarLeads: m.listarLeads }));
vi.mock("./cs", () => ({ listarVendasCs: m.listarVendasCs }));

import { panoramaWhatsapp } from "./visao-geral";

const gestor = { id: "u1", papel: "admin" } as unknown as UsuarioAtual;
const AGORA = new Date("2026-11-24T15:00:00.000Z");
const lead = (temperatura: string, situacaoLead: string | null = "em_conversa") => ({ temperatura, situacaoLead });

beforeEach(() => {
  vi.resetAllMocks();
  m.listarNumeros.mockResolvedValue([
    { id: "n1", nome: "Vendas 1", time: "comercial", dono: "Ana", estado: "conectado", rotulo: "Conectado", conectadoEm: new Date("2026-11-20T10:00:00Z"), ultimoSinalEm: new Date("2026-11-24T14:00:00Z") },
    { id: "n2", nome: "Vendas 2", time: "comercial", dono: null, estado: "desconectado", rotulo: "Desconectado", conectadoEm: new Date("2026-11-01T10:00:00Z"), ultimoSinalEm: new Date("2026-11-22T14:00:00Z") },
  ]);
  m.semRespostaAgora.mockResolvedValue([{ numeroId: "n1" }, { numeroId: "n1" }]);
  m.resumoDaSemana.mockResolvedValue([
    { numeroId: "n1", conversas: 12, semRespostaAgora: 2, notaDecimos: 74 },
    { numeroId: "n2", conversas: 0, semRespostaAgora: 0, notaDecimos: null },
  ]);
  m.listarLeads.mockResolvedValue({ itens: [] });
  m.listarVendasCs.mockResolvedValue({ semNumeroCs: false, vendas: [], medianaSeg: null, aguardando: 3 });
});

describe("panoramaWhatsapp", () => {
  it("exige whatsapp:ver_equipe", async () => {
    await expect(panoramaWhatsapp({ id: "u2", papel: "comercial" } as unknown as UsuarioAtual, AGORA)).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("junta números, métricas da semana e atenção", async () => {
    const p = await panoramaWhatsapp(gestor, AGORA);
    expect(p.numeros[0].conversasSemana).toBe(12);
    expect(p.numeros[0].semRespostaAgora).toBe(2);
    expect(p.numeros[0].desde).toEqual(new Date("2026-11-20T10:00:00Z"));
    expect(p.numeros[1].desde).toEqual(new Date("2026-11-22T14:00:00Z"));
    expect(p.atencao.desconectados).toBe(1);
    expect(p.atencao.semRespostaAgora).toBe(2);
    expect(p.atencao.csAguardando).toBe(3);
    expect(m.listarVendasCs).toHaveBeenCalledWith(gestor, new Date("2026-11-01T03:00:00.000Z"), AGORA, AGORA, { incluirAguardandoAnteriores: true });
  });

  it("conta só quentes e mornos ainda abertos", async () => {
    m.listarLeads.mockResolvedValue({
      itens: [lead("quente"), lead("quente"), lead("quente", "fechou"), lead("morno"), lead("morno", null), lead("frio"), lead("frio"), lead("frio"), lead("frio")],
    });
    const p = await panoramaWhatsapp(gestor, AGORA);
    expect(p.oportunidades).toMatchObject({ quentes: 2, mornos: 2 });
  });

  it("falha em listarLeads zera só as oportunidades", async () => {
    m.listarLeads.mockRejectedValue(new Error("falhou"));
    const p = await panoramaWhatsapp(gestor, AGORA);
    expect(p.oportunidades).toBeNull();
    expect(p.numeros).toHaveLength(2);
    expect(p.atencao.csAguardando).toBe(3);
  });

  it("sem número de CS, csAguardando é null", async () => {
    m.listarVendasCs.mockResolvedValue({ semNumeroCs: true, vendas: [], medianaSeg: null, aguardando: 0 });
    expect((await panoramaWhatsapp(gestor, AGORA)).atencao.csAguardando).toBeNull();
  });
});
