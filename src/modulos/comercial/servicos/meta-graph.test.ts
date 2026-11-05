import { describe, expect, it } from "vitest";
import campanhas from "./__fixtures__/meta/campanhas.json";
import contas from "./__fixtures__/meta/contas.json";
import erro190 from "./__fixtures__/meta/erro-190.json";
import insights1 from "./__fixtures__/meta/insights-1.json";
import insights2 from "./__fixtures__/meta/insights-2.json";
import { ErroMeta, criarClienteMeta } from "./meta-graph";

const TOKEN = "TOKEN-DE-TESTE";
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

/** Serve as respostas gravadas conforme a URL pedida. */
const fetchFalso = (async (entrada: string | URL | Request) => {
  const url = String(entrada);
  if (url.includes("/me/adaccounts")) return resposta(contas);
  if (url.includes("/campaigns")) return resposta(campanhas);
  if (url.includes("/insights")) return resposta(url.includes("after=X") ? insights2 : insights1);
  throw new Error(`URL inesperada: ${url}`);
}) as typeof fetch;

describe("cliente da Graph API", () => {
  it("lista contas e campanhas", async () => {
    const cliente = criarClienteMeta(TOKEN, fetchFalso);
    expect(await cliente.listarContas()).toEqual(contas.data);
    expect(await cliente.listarCampanhas("act_111")).toEqual(campanhas.data);
  });

  it("segue a paginação dos insights até o fim", async () => {
    const linhas = await criarClienteMeta(TOKEN, fetchFalso).listarInsights("act_111", "2026-11-01", "2026-11-02");
    expect(linhas.map((l) => l.date_start)).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("pede os insights por campanha e por dia, no período", async () => {
    const urls: string[] = [];
    const espiao = (async (entrada: string | URL | Request) => {
      urls.push(String(entrada));
      return resposta(insights2);
    }) as typeof fetch;
    await criarClienteMeta(TOKEN, espiao).listarInsights("act_111", "2026-11-01", "2026-11-02");
    const url = new URL(urls[0]!);
    expect(url.pathname).toMatch(/^\/v\d+\.0\/act_111\/insights$/);
    expect(url.searchParams.get("level")).toBe("campaign");
    expect(url.searchParams.get("time_increment")).toBe("1");
    expect(JSON.parse(url.searchParams.get("time_range")!)).toEqual({ since: "2026-11-01", until: "2026-11-02" });
  });

  it("pede anúncios com a miniatura e os insights por anúncio e por dia", async () => {
    const urls: string[] = [];
    const espiao = (async (entrada: string | URL | Request) => {
      urls.push(String(entrada));
      return resposta({ data: [] });
    }) as typeof fetch;
    const cliente = criarClienteMeta(TOKEN, espiao);
    await cliente.listarAnuncios("act_111");
    await cliente.listarInsightsAnuncios("act_111", "2026-11-01", "2026-11-02");
    const anuncios = new URL(urls[0]!);
    expect(anuncios.pathname).toMatch(/\/act_111\/ads$/);
    expect(anuncios.searchParams.get("fields")).toContain("creative{thumbnail_url,image_url}");
    const insights = new URL(urls[1]!);
    expect(insights.searchParams.get("level")).toBe("ad");
    expect(insights.searchParams.get("fields")).toContain("ad_id");
    expect(insights.searchParams.get("time_increment")).toBe("1");
  });

  it("manda a chave no header Authorization, nunca na URL", async () => {
    const pedidos: { url: string; auth: string | null }[] = [];
    const espiao = (async (entrada: string | URL | Request, init?: RequestInit) => {
      pedidos.push({ url: String(entrada), auth: new Headers(init?.headers).get("authorization") });
      return resposta(contas);
    }) as typeof fetch;
    await criarClienteMeta(TOKEN, espiao).listarContas();
    expect(pedidos[0]?.auth).toBe(`Bearer ${TOKEN}`);
    expect(pedidos[0]?.url).not.toContain(TOKEN);
  });

  it("erro da Meta vira ErroMeta em português, sem a chave nem a URL", async () => {
    const falha = (async () => resposta(erro190, 400)) as typeof fetch;
    const erro = await criarClienteMeta(TOKEN, falha)
      .listarContas()
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMeta);
    expect((erro as ErroMeta).codigo).toBe(190);
    expect((erro as ErroMeta).message).toBe("A chave de acesso da Meta é inválida ou foi revogada.");
    expect((erro as ErroMeta).message).not.toContain(TOKEN);
  });

  it("falha de rede vira ErroMeta sem a URL", async () => {
    const semRede = (async () => {
      throw new TypeError(`fetch failed for https://graph.facebook.com/?access_token=${TOKEN}`);
    }) as typeof fetch;
    const erro = await criarClienteMeta(TOKEN, semRede)
      .listarContas()
      .catch((e: unknown) => e);
    expect((erro as ErroMeta).message).toBe("Não foi possível falar com a Meta.");
    expect(JSON.stringify(erro)).not.toContain(TOKEN);
    expect(String((erro as ErroMeta).cause ?? "")).not.toContain(TOKEN);
  });
});
