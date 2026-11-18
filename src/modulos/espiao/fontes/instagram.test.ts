import { describe, expect, it } from "vitest";
import { ErroMeta } from "@/lib/meta-graph";
import { ErroNegocio } from "@/lib/erros";
import bd from "./__fixtures__/business-discovery-1.json";
import erroPessoal from "./__fixtures__/business-discovery-erro-pessoal.json";
import { criarClienteBusinessDiscovery } from "./instagram";

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

function fetchFalso(corpo: unknown, status = 200) {
  const urls: URL[] = [];
  const fn = (async (entrada: string | URL | Request) => {
    urls.push(new URL(String(entrada)));
    return resposta(corpo, status);
  }) as typeof fetch;
  return { fn, urls };
}

describe("criarClienteBusinessDiscovery", () => {
  it("converte o business discovery em PerfilBD", async () => {
    const { fn } = fetchFalso(bd);
    const perfil = await criarClienteBusinessDiscovery("T", fn).perfil("178", "concorrente.x", 12);
    expect(perfil).toMatchObject({ usuario: "concorrente.x", nome: "Concorrente X Pós", seguidores: 15230, totalPosts: 812, site: "https://concorrentex.com.br/pos" });
    expect(perfil.midias[0]).toMatchObject({ idExterno: "m1", tipo: "reels", visualizacoes: 52000, curtidas: 900, mediaUrl: "https://scontent.cdninstagram.com/v/m1.mp4" });
    expect(perfil.midias[0].publicadoEm.toISOString()).toBe("2026-11-16T15:00:00.000Z");
    expect(perfil.midias[1]).toMatchObject({ tipo: "carrossel", visualizacoes: null, mediaUrl: null });
    expect(perfil.midias[2]).toMatchObject({ tipo: "reels", legenda: null, mediaUrl: null });
    expect(perfil.midias[3]).toMatchObject({ tipo: "post", curtidas: null });
  });

  it("normaliza o @ na URL pedida", async () => {
    const { fn, urls } = fetchFalso(bd);
    await criarClienteBusinessDiscovery("T", fn).perfil("178", "@Concorrente.X ", 12);
    const campos = urls[0].searchParams.get("fields") ?? "";
    expect(urls[0].pathname.endsWith("/178")).toBe(true);
    expect(campos).toContain("business_discovery.username(concorrente.x)");
    expect(campos).toContain("media.limit(12)");
    expect(campos).toContain("view_count");
  });

  it("recusa @ inválido", async () => {
    const { fn, urls } = fetchFalso(bd);
    await expect(criarClienteBusinessDiscovery("T", fn).perfil("178", "a b", 12)).rejects.toBeInstanceOf(ErroNegocio);
    expect(urls).toHaveLength(0);
  });

  it("perfil pessoal vira ErroMeta com mensagem em português", async () => {
    const { fn } = fetchFalso(erroPessoal, 400);
    const erro = await criarClienteBusinessDiscovery("T", fn).perfil("178", "pessoa", 12).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroMeta);
    expect(erro.message).toBe("Perfil não encontrado ou não é uma conta profissional (Business ou Criador de conteúdo).");
  });
});
