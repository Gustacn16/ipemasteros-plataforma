import { describe, expect, it } from "vitest";
import { BASE_GRAPH, ErroMeta, criarPedidosGraph } from "./meta-graph";

const TOKEN = "TOKEN-DE-TESTE";
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const traduzir = (codigo: number | undefined, mensagem: string) => `traduzido ${codigo ?? "-"}: ${mensagem}`;

/** Guarda as URLs e os headers pedidos e responde em sequência. */
function fetchGravado(respostas: Response[]) {
  const pedidos: { url: string; headers: Headers }[] = [];
  const fn = (async (entrada: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(entrada), headers: new Headers(init?.headers) });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta");
    return r;
  }) as typeof fetch;
  return { fn, pedidos };
}

describe("base da Graph API", () => {
  it("segue paging.next até a última página", async () => {
    const { fn, pedidos } = fetchGravado([
      resposta({ data: [{ id: "1" }], paging: { next: `${BASE_GRAPH}/x?after=A` } }),
      resposta({ data: [{ id: "2" }] }),
    ]);
    const itens = await criarPedidosGraph(TOKEN, traduzir, fn).todas<{ id: string }>("x", { limit: "1" });
    expect(itens.map((i) => i.id)).toEqual(["1", "2"]);
    expect(pedidos[0]!.url).toBe(`${BASE_GRAPH}/x?limit=1`);
  });

  it("para de paginar no primeiro item em que `parar` é verdadeiro e corta a página", async () => {
    const { fn, pedidos } = fetchGravado([resposta({ data: [{ n: 3 }, { n: 2 }, { n: 1 }], paging: { next: `${BASE_GRAPH}/x?after=A` } })]);
    const itens = await criarPedidosGraph(TOKEN, traduzir, fn).todas<{ n: number }>("x", {}, (i) => i.n < 2);
    expect(itens).toEqual([{ n: 3 }, { n: 2 }]);
    expect(pedidos).toHaveLength(1);
  });

  it("erro da Meta vira ErroMeta com a mensagem traduzida e o código", async () => {
    const { fn } = fetchGravado([resposta({ error: { code: 190, message: "Invalid OAuth" } }, 400)]);
    const erro = await criarPedidosGraph(TOKEN, traduzir, fn)
      .pedir("me")
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMeta);
    expect((erro as ErroMeta).message).toBe("traduzido 190: Invalid OAuth");
    expect((erro as ErroMeta).codigo).toBe(190);
  });

  it("falha de rede vira mensagem em português", async () => {
    const fn = (async () => {
      throw new Error(`falhou ${TOKEN}`);
    }) as typeof fetch;
    await expect(criarPedidosGraph(TOKEN, traduzir, fn).pedir("me")).rejects.toThrow(new ErroMeta("Não foi possível falar com a Meta."));
  });

  it("manda a chave no header Authorization e nunca na URL", async () => {
    const { fn, pedidos } = fetchGravado([resposta({ id: "1" })]);
    await criarPedidosGraph(TOKEN, traduzir, fn).pedir("me");
    expect(pedidos[0]!.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(pedidos[0]!.url).toBe(`${BASE_GRAPH}/me`);
    expect(pedidos[0]!.url).not.toContain(TOKEN);
  });
});
