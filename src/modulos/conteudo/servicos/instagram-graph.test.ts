import { describe, expect, it } from "vitest";
import { ErroMeta } from "@/lib/meta-graph";
import contas from "./__fixtures__/instagram/contas.json";
import erro190 from "./__fixtures__/instagram/erro-190.json";
import insightsConta from "./__fixtures__/instagram/insights-conta.json";
import insightsPost from "./__fixtures__/instagram/insights-post.json";
import erroStory10 from "./__fixtures__/instagram/insights-story-erro-10.json";
import midias1 from "./__fixtures__/instagram/midias-1.json";
import midias2 from "./__fixtures__/instagram/midias-2.json";
import perfil from "./__fixtures__/instagram/perfil.json";
import permissoes from "./__fixtures__/instagram/permissoes.json";
import stories from "./__fixtures__/instagram/stories.json";
import { criarClienteInstagram } from "./instagram-graph";

const TOKEN = "TOKEN-DE-TESTE";
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

/** Serve as respostas gravadas conforme a URL pedida e guarda as URLs. */
function fetchFalso(rotas: (url: URL) => Response | undefined) {
  const urls: URL[] = [];
  const fn = (async (entrada: string | URL | Request) => {
    const url = new URL(String(entrada));
    urls.push(url);
    const r = rotas(url);
    if (!r) throw new Error(`URL inesperada: ${url}`);
    return r;
  }) as typeof fetch;
  return { fn, urls };
}

const padrao = fetchFalso((url) => {
  if (url.pathname.endsWith("/me/accounts")) return resposta(contas);
  if (url.pathname.endsWith("/me/permissions")) return resposta(permissoes);
  if (url.pathname.endsWith("/IG1/media")) return resposta(url.searchParams.get("after") === "PAGINA2" ? midias2 : midias1);
  if (url.pathname.endsWith("/IG1/stories")) return resposta(stories);
  if (url.pathname.endsWith("/IG1/insights")) return resposta(insightsConta);
  if (url.pathname.endsWith("/IG1")) return resposta(perfil);
  if (url.pathname.endsWith("/M1/insights")) return resposta(insightsPost);
  if (url.pathname.endsWith("/S1/insights")) return resposta(erroStory10, 400);
  if (url.pathname.endsWith("/M9/insights")) return resposta(erro190, 400);
  return undefined;
});
const cliente = criarClienteInstagram(TOKEN, padrao.fn);

describe("cliente do Instagram", () => {
  it("lista as contas e ignora páginas sem Instagram", async () => {
    expect(await cliente.listarContas()).toEqual([
      { idExterno: "IG1", usuario: "ipemaster", nome: "IPEMaster", paginaId: "PAG1", fotoUrl: "https://cdn.exemplo/foto.jpg" },
    ]);
  });

  it("segue a paginação dos posts e para no primeiro anterior ao início", async () => {
    const midias = await cliente.listarMidias("IG1", new Date("2026-01-01T03:00:00Z"));
    expect(midias.map((m) => m.id)).toEqual(["M3", "M2", "M1"]);
    expect(padrao.urls.some((u) => u.searchParams.get("after") === "PAGINA3")).toBe(false);
  });

  it("lista os stories no ar", async () => {
    expect((await cliente.listarStories("IG1")).map((s) => s.id)).toEqual(["S1"]);
  });

  it("pede só as métricas do tipo", async () => {
    const insights = await cliente.insightsMidia("M1", "reels");
    expect(insights.map((i) => i.name)).toEqual(["reach", "likes"]);
    const url = padrao.urls.findLast((u) => u.pathname.endsWith("/M1/insights"))!;
    expect(url.searchParams.get("metric")).toBe("reach,views,likes,comments,saved,shares,total_interactions");
  });

  it("story com poucas visualizações (erro 10) volta sem números, sem erro", async () => {
    expect(await cliente.insightsMidia("S1", "story")).toEqual([]);
  });

  it("erro 190 vira ErroMeta em português", async () => {
    const erro = await cliente.insightsMidia("M9", "post").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMeta);
    expect((erro as ErroMeta).message).toBe("A chave de acesso da Meta é inválida ou foi revogada.");
  });

  it("insights da conta usam o dia inteiro de São Paulo", async () => {
    await cliente.insightsConta("IG1", "2026-11-01", "2026-11-01");
    const [totais, seguir] = padrao.urls.filter((u) => u.pathname.endsWith("/IG1/insights")).slice(-2) as [URL, URL];
    for (const url of [totais, seguir]) {
      expect(url.searchParams.get("since")).toBe(String(Date.parse("2026-11-01T03:00:00Z") / 1000));
      expect(url.searchParams.get("until")).toBe(String(Date.parse("2026-11-02T03:00:00Z") / 1000));
      expect(url.searchParams.get("period")).toBe("day");
      expect(url.searchParams.get("metric_type")).toBe("total_value");
    }
    // Só follows_and_unfollows aceita a divisão por follow_type: pedir junto com as outras daria erro.
    expect(totais.searchParams.get("breakdown")).toBeNull();
    expect(totais.searchParams.get("metric")).not.toContain("follows_and_unfollows");
    expect(seguir.searchParams.get("metric")).toBe("follows_and_unfollows");
    expect(seguir.searchParams.get("breakdown")).toBe("follow_type");
  });

  it("lê seguidores e permissões", async () => {
    expect(await cliente.seguidores("IG1")).toBe(12345);
    expect(await cliente.permissoes()).toEqual(permissoes.data);
  });

  it("nenhuma URL leva a chave", () => {
    expect(padrao.urls.length).toBeGreaterThan(0);
    for (const u of padrao.urls) expect(String(u)).not.toContain(TOKEN);
  });
});
