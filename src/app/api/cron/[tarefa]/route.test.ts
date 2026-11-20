import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  criarLoteDoDia: vi.fn(),
  criarLoteAvaliacoes: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modulos/comercial/servicos/importacao-meta", () => ({ importarMetaAds: vi.fn() }));
vi.mock("@/modulos/conteudo/servicos/atualizacao-instagram", () => ({ atualizarInstagram: vi.fn() }));
vi.mock("@/modulos/whatsapp/servicos/metricas", () => ({ recalcularMetricas: vi.fn() }));
vi.mock("@/modulos/whatsapp/servicos/limpeza", () => ({ limparWhatsapp: vi.fn() }));
vi.mock("@/modulos/whatsapp/servicos/lote-ia", () => ({ coletarLotes: vi.fn(), criarLoteDoDia: mocks.criarLoteDoDia }));
vi.mock("@/modulos/whatsapp/servicos/lote-avaliacao", () => ({ criarLoteAvaliacoes: mocks.criarLoteAvaliacoes }));
vi.mock("@/modulos/nexu/servicos/limpeza", () => ({ limparConversasAntigas: vi.fn() }));
vi.mock("@/modulos/espiao/servicos/coleta", () => ({ iniciarColeta: vi.fn() }));
vi.mock("@/modulos/espiao/servicos/limpeza", () => ({ limparEspiaoAntigo: vi.fn() }));

import { GET } from "./route";

const chamar = (tarefa: string) =>
  GET(new Request("http://x/api/cron/" + tarefa, { headers: { authorization: "Bearer s3gredo" } }), {
    params: Promise.resolve({ tarefa }),
  } as Parameters<typeof GET>[1]);

beforeEach(() => {
  process.env.CRON_SECRET = "s3gredo";
  mocks.criarLoteDoDia.mockReset();
  mocks.criarLoteAvaliacoes.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cron ia-whatsapp", () => {
  it("roda os resumos e depois as avaliações", async () => {
    const ordem: string[] = [];
    mocks.criarLoteDoDia.mockImplementation(async () => (ordem.push("resumos"), { criado: true, pedidos: 2, semVerba: 0 }));
    mocks.criarLoteAvaliacoes.mockImplementation(async () => (ordem.push("avaliacoes"), { criado: true, pedidos: 3, semVerba: 1 }));
    const r = await chamar("ia-whatsapp");
    expect(await r.json()).toEqual({
      ok: true,
      resumos: { criado: true, pedidos: 2, semVerba: 0 },
      avaliacoes: { criado: true, pedidos: 3, semVerba: 1 },
    });
    expect(ordem).toEqual(["resumos", "avaliacoes"]);
  });

  it("roda as avaliações mesmo quando os resumos lançam erro (o log leva só o nome do erro)", async () => {
    mocks.criarLoteDoDia.mockRejectedValue(new Error("segredo do banco"));
    mocks.criarLoteAvaliacoes.mockResolvedValue({ criado: true, pedidos: 1, semVerba: 0 });
    const r = await chamar("ia-whatsapp");
    const corpo = await r.json();
    expect(corpo).toMatchObject({ ok: true, avaliacoes: { criado: true, pedidos: 1 } });
    expect(corpo.resumos).toMatchObject({ criado: false, motivo: "erro" });
    expect(mocks.criarLoteAvaliacoes).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("segredo");
  });
});
