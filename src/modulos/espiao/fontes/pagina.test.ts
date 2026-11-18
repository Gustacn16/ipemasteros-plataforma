import { describe, expect, it } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { baixarPagina, ipPrivado, lerPagina } from "./pagina";

const publico = async () => ["93.184.216.34"];
const html = (corpo: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(corpo, { status, headers: { "content-type": "text/html", ...headers } });

function fetchFalso(respostas: Record<string, () => Response>) {
  const pedidos: string[] = [];
  const fn = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    pedidos.push(url);
    expect(init?.redirect).toBe("manual");
    const r = respostas[url];
    if (!r) throw new Error(`URL inesperada: ${url}`);
    return r();
  }) as typeof fetch;
  return { fn, pedidos };
}

describe("ipPrivado", () => {
  it("reconhece redes internas, locais e IPv4 mapeado", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"])
      expect(ipPrivado(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"]) expect(ipPrivado(ip), ip).toBe(false);
  });
});

describe("baixarPagina", () => {
  it("recusa IP interno direto e protocolo que não é http", async () => {
    const { fn, pedidos } = fetchFalso({});
    for (const url of ["http://127.0.0.1/", "http://10.0.0.5/", "http://169.254.169.254/latest", "ftp://x.com/"]) {
      await expect(baixarPagina(url, { fetchFn: fn, resolver: async (h) => [h] }), url).rejects.toThrow("Endereço não permitido");
    }
    expect(pedidos).toHaveLength(0);
  });

  it("recusa domínio que resolve para rede interna", async () => {
    const { fn } = fetchFalso({});
    await expect(baixarPagina("https://interno.exemplo.com/", { fetchFn: fn, resolver: async () => ["10.1.2.3"] })).rejects.toThrow("Endereço não permitido");
  });

  it("recusa redirecionamento para rede interna", async () => {
    const { fn } = fetchFalso({ "https://a.com/": () => html("", 302, { location: "http://192.168.0.1/" }) });
    const resolver = async (h: string) => (h === "a.com" ? ["93.184.216.34"] : [h]);
    await expect(baixarPagina("https://a.com/", { fetchFn: fn, resolver })).rejects.toThrow("Endereço não permitido");
  });

  it("segue até 3 redirecionamentos e para no 4º", async () => {
    const r = (de: string, para: string) => [de, () => html("", 301, { location: para })] as const;
    const tres = fetchFalso(Object.fromEntries([r("https://a.com/0", "/1"), r("https://a.com/1", "/2"), r("https://a.com/2", "/3"), ["https://a.com/3", () => html("<body>ok</body>")]]));
    await expect(baixarPagina("https://a.com/0", { fetchFn: tres.fn, resolver: publico })).resolves.toMatchObject({ urlFinal: "https://a.com/3" });
    const quatro = fetchFalso(Object.fromEntries([r("https://a.com/0", "/1"), r("https://a.com/1", "/2"), r("https://a.com/2", "/3"), r("https://a.com/3", "/4")]));
    await expect(baixarPagina("https://a.com/0", { fetchFn: quatro.fn, resolver: publico })).rejects.toThrow("Não foi possível abrir a página");
  });

  it("corpo acima de 2 MB lança", async () => {
    const { fn } = fetchFalso({ "https://a.com/": () => html("x".repeat(2 * 1024 * 1024 + 1)) });
    const erro = await baixarPagina("https://a.com/", { fetchFn: fn, resolver: publico }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect(erro.message).toBe("Página grande demais");
  });
});

describe("lerPagina", () => {
  it("página curta não é legível", async () => {
    const { fn } = fetchFalso({ "https://a.com/": () => html(`<body>${"a".repeat(200)}</body>`) });
    await expect(lerPagina("https://a.com/", { fetchFn: fn, resolver: publico })).resolves.toMatchObject({ legivel: false });
  });

  it("página de venda é legível e traz os preços", async () => {
    const corpo = `<body><h1>Pós em Dermatologia</h1><p>${"Conteúdo completo do curso. ".repeat(15)}</p><p>12x de R$ 899 ou R$ 9.990,00</p></body>`;
    const { fn } = fetchFalso({ "https://a.com/": () => html(corpo) });
    const r = await lerPagina("https://a.com/", { fetchFn: fn, resolver: publico });
    expect(r.legivel).toBe(true);
    expect(r.precos).toEqual(["12x R$ 899,00", "R$ 9.990,00"]);
  });
});
