import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroHttp } from "./erro-http.ts";

vi.mock("./config.ts", () => ({ config: { sistemaUrl: "http://localhost:3000", segredo: "s", pastaSessoes: "./x" } }));

const { buscarComandos, enviarEventos } = await import("./api.ts");

describe("api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resposta não-OK vira ErroHttp com o status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 400 })));
    const erro = await enviarEventos([]).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroHttp);
    expect((erro as ErroHttp).status).toBe(400);
  });

  it("buscarComandos pede os comandos de enviar_grupo", async () => {
    const fetchFalso = vi.fn(async (_url: string) => Response.json({ comandos: [] }));
    vi.stubGlobal("fetch", fetchFalso);
    await buscarComandos();
    expect(fetchFalso.mock.calls[0][0]).toBe("http://localhost:3000/api/whatsapp/motor/comandos?recursos=enviar_grupo");
  });

  it("POST /eventos espera até 60 s; os comandos continuam com 15 s", async () => {
    const tempo = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ comandos: [] })));
    await enviarEventos([]);
    await buscarComandos();
    expect(tempo.mock.calls).toEqual([[60_000], [15_000]]);
  });
});
