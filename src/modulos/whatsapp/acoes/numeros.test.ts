import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";

const m = vi.hoisted(() => ({
  papel: "admin",
  salvar: vi.fn(async () => {}),
  salvarRegras: vi.fn(async () => {}),
  alterarTime: vi.fn(async () => {}),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("qrcode", () => ({ default: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/sessao", () => ({
  exigirUsuario: async () => ({ id: "u1", papel: m.papel }),
  exigirPermissao: async () => {
    if (m.papel === "comercial") throw new ErroPermissao("whatsapp:gerenciar_numeros");
    return { id: "u1", papel: m.papel };
  },
}));
vi.mock("../servicos/configuracao", () => ({ salvarConfiguracaoWhatsapp: m.salvar, salvarRegrasAtendimento: m.salvarRegras }));
vi.mock("../servicos/numeros", () => ({ alterarTimeNumero: m.alterarTime }));
vi.mock("../servicos/titular", () => ({}));

const { alterarTimeNumeroAcao, salvarLimiteIaWhatsappAcao, salvarRegrasAtendimentoAcao } = await import("./numeros");
const { REGRAS_PADRAO } = await import("../esquemas/regras-atendimento");

beforeEach(() => {
  m.papel = "admin";
  m.salvar.mockClear();
  m.salvarRegras.mockClear();
});

describe("salvarLimiteIaWhatsappAcao", () => {
  it("gestor é negado e nada é salvo", async () => {
    m.papel = "gestor";
    const r = await salvarLimiteIaWhatsappAcao({ limiteUsd: "10" });
    expect(r.ok).toBe(false);
    expect(m.salvar).not.toHaveBeenCalled();
  });

  it("admin salva US$ 12,34 como 12_340_000 micro", async () => {
    const r = await salvarLimiteIaWhatsappAcao({ limiteUsd: "12,34" });
    expect(r.ok).toBe(true);
    expect(m.salvar).toHaveBeenCalledWith({ limiteMensalMicroUsd: 12_340_000 }, "u1");
  });

  it("fora da faixa e vazio são recusados", async () => {
    for (const v of ["501", "-1", "", "  ", "abc"]) {
      const r = await salvarLimiteIaWhatsappAcao({ limiteUsd: v });
      expect(r.ok).toBe(false);
    }
    expect((await salvarLimiteIaWhatsappAcao({ limiteUsd: "" })).erros?.limiteUsd?.[0]).toBe("Informe o limite em dólares.");
    expect(m.salvar).not.toHaveBeenCalled();
  });
});

describe("alterarTimeNumeroAcao", () => {
  it("ação recusa time desconhecido", async () => {
    const r = await alterarTimeNumeroAcao({ numeroId: "n1", time: "vendas" });
    expect(r.ok).toBe(false);
    expect(m.alterarTime).not.toHaveBeenCalled();
  });

  it("time válido chama o serviço", async () => {
    const r = await alterarTimeNumeroAcao({ numeroId: "n1", time: "cs" });
    expect(r.ok).toBe(true);
    expect(m.alterarTime).toHaveBeenCalledWith({ id: "u1", papel: "admin" }, "n1", "cs");
  });
});

describe("salvarRegrasAtendimentoAcao", () => {
  it("salvarRegrasAtendimentoAcao recusa gestor", async () => {
    m.papel = "gestor";
    const r = await salvarRegrasAtendimentoAcao(REGRAS_PADRAO);
    expect(r.ok).toBe(false);
    expect(m.salvarRegras).not.toHaveBeenCalled();
  });

  it("comercial também é recusado", async () => {
    m.papel = "comercial";
    expect((await salvarRegrasAtendimentoAcao(REGRAS_PADRAO)).ok).toBe(false);
    expect(m.salvarRegras).not.toHaveBeenCalled();
  });

  it("admin repassa os dados ao serviço, que valida", async () => {
    const r = await salvarRegrasAtendimentoAcao(REGRAS_PADRAO);
    expect(r.ok).toBe(true);
    expect(m.salvarRegras).toHaveBeenCalledWith(REGRAS_PADRAO, "u1");
  });
});
