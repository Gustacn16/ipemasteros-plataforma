import { describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { PerfilBD } from "../fontes/instagram";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ contaInstagram: { findFirst: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks }));
const { testarPerfil, igUserIdDaIpemaster } = await import("./testar-perfil");

const admin = { id: "u1", papel: "admin" } as never;
const gestor = { id: "u2", papel: "gestor" } as never;

const perfil: PerfilBD = {
  usuario: "x", nome: null, biografia: null, site: null, seguidores: 10, totalPosts: 3,
  midias: [
    { idExterno: "1", tipo: "reels", legenda: null, permalink: "p", publicadoEm: new Date(), curtidas: 1, comentarios: 0, visualizacoes: 9, mediaUrl: "u" },
    { idExterno: "2", tipo: "reels", legenda: null, permalink: "p", publicadoEm: new Date(), curtidas: null, comentarios: 0, visualizacoes: null, mediaUrl: null },
    { idExterno: "3", tipo: "post", legenda: null, permalink: "p", publicadoEm: new Date(), curtidas: 4, comentarios: 0, visualizacoes: null, mediaUrl: "img" },
  ],
};

describe("testarPerfil", () => {
  it("exige espiao:configurar", async () => {
    await expect(testarPerfil(gestor, "x", { cliente: { perfil: async () => perfil }, igUserId: async () => "1" })).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("conta quantas mídias trouxeram cada campo e o vídeo dos Reels", async () => {
    const r = await testarPerfil(admin, "x", { cliente: { perfil: async () => perfil }, igUserId: async () => "1" });
    expect(r.campos).toEqual({ midias: 3, visualizacoes: 1, curtidas: 2, reels: 2, mediaUrlReels: 1 });
  });
});

describe("igUserIdDaIpemaster", () => {
  it("usa a primeira conta ativa", async () => {
    mocks.contaInstagram.findFirst.mockResolvedValue({ idExterno: "178" });
    await expect(igUserIdDaIpemaster()).resolves.toBe("178");
    expect(mocks.contaInstagram.findFirst.mock.calls[0][0].where).toEqual({ ativa: true });
  });

  it("sem conta ativa, explica onde ligar", async () => {
    mocks.contaInstagram.findFirst.mockResolvedValue(null);
    await expect(igUserIdDaIpemaster()).rejects.toThrow("Nenhuma conta do Instagram da IPEMaster ligada");
  });
});
