import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";

const m = vi.hoisted(() => ({ papel: "admin", salvar: vi.fn(async () => {}) }));

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
vi.mock("../servicos/configuracao", () => ({ salvarConfiguracaoWhatsapp: m.salvar }));
vi.mock("../servicos/numeros", () => ({}));
vi.mock("../servicos/titular", () => ({}));

const { salvarLimiteIaWhatsappAcao } = await import("./numeros");

beforeEach(() => {
  m.papel = "admin";
  m.salvar.mockClear();
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
