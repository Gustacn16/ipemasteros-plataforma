import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modulos/whatsapp/servicos/motor", () => ({
  aplicarEventos: vi.fn(),
  entregarComandos: vi.fn(),
  concluirComando: vi.fn(),
}));

import { GET as getComandos } from "@/app/api/whatsapp/motor/comandos/route";
import { POST as postResultado } from "@/app/api/whatsapp/motor/comandos/[id]/route";
import { POST as postEventos } from "@/app/api/whatsapp/motor/eventos/route";
import { aplicarEventos, concluirComando, entregarComandos } from "@/modulos/whatsapp/servicos/motor";

const SEGREDO = "segredo-de-teste";
const url = "http://localhost/api/whatsapp/motor";

function requisicao(corpo?: string, autorizacao: string | null = `Bearer ${SEGREDO}`, metodo = "POST") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (autorizacao !== null) headers.authorization = autorizacao;
  return new Request(url, { method: metodo, headers, body: metodo === "GET" ? undefined : corpo });
}
const contexto = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

beforeEach(() => {
  process.env.MOTOR_WHATSAPP_SEGREDO = SEGREDO;
  vi.mocked(aplicarEventos).mockReset();
  vi.mocked(entregarComandos).mockReset();
  vi.mocked(concluirComando).mockReset();
});
afterEach(() => {
  delete process.env.MOTOR_WHATSAPP_SEGREDO;
});

describe("POST /eventos", () => {
  const lote = JSON.stringify({ eventos: [{ tipo: "sinal", conectados: [] }] });

  it("recusa sem header", async () => {
    const r = await postEventos(requisicao(lote, null));
    expect(r.status).toBe(401);
    expect(aplicarEventos).not.toHaveBeenCalled();
  });
  it("recusa segredo errado", async () => {
    expect((await postEventos(requisicao(lote, "Bearer outro"))).status).toBe(401);
  });
  it("recusa tudo se o segredo não está configurado", async () => {
    process.env.MOTOR_WHATSAPP_SEGREDO = "";
    expect((await postEventos(requisicao(lote, "Bearer "))).status).toBe(401);
  });
  it("400 para lote inválido e para JSON quebrado", async () => {
    const r = await postEventos(requisicao(JSON.stringify({ eventos: [{ tipo: "x" }] })));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false });
    expect((await postEventos(requisicao("{não é json"))).status).toBe(400);
  });
  it("200 com os números do serviço", async () => {
    vi.mocked(aplicarEventos).mockResolvedValue({ aplicados: 1, ignorados: 2 });
    const r = await postEventos(requisicao(lote));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, aplicados: 1, ignorados: 2 });
  });
});

describe("GET /comandos", () => {
  it("401 sem segredo válido", async () => {
    expect((await getComandos(requisicao(undefined, "Bearer x", "GET"))).status).toBe(401);
  });
  it("200 com os comandos entregues", async () => {
    const comandos = [{ id: "c1", numeroId: "n1", tipo: "conectar" as const }];
    vi.mocked(entregarComandos).mockResolvedValue(comandos);
    const r = await getComandos(requisicao(undefined, undefined, "GET"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ comandos });
    expect(entregarComandos).toHaveBeenCalledWith(expect.any(Date), { recursos: [] });
  });
  it("repassa os recursos declarados pelo motor", async () => {
    vi.mocked(entregarComandos).mockResolvedValue([]);
    const req = new Request(`${url}/comandos?recursos=enviar_grupo, outro`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    await getComandos(req);
    expect(entregarComandos).toHaveBeenCalledWith(expect.any(Date), { recursos: ["enviar_grupo", "outro"] });
  });
});

describe("POST /comandos/:id", () => {
  it("401 sem segredo válido", async () => {
    const r = await postResultado(requisicao(JSON.stringify({ situacao: "concluido" }), null), contexto("c1"));
    expect(r.status).toBe(401);
  });
  it("400 para corpo inválido", async () => {
    const r = await postResultado(requisicao(JSON.stringify({ situacao: "talvez" })), contexto("c1"));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false });
    expect((await postResultado(requisicao("não json"), contexto("c1"))).status).toBe(400);
  });
  it("404 para comando desconhecido", async () => {
    vi.mocked(concluirComando).mockResolvedValue(false);
    const r = await postResultado(requisicao(JSON.stringify({ situacao: "concluido" })), contexto("nao-existe"));
    expect(r.status).toBe(404);
  });
  it("200 quando conclui", async () => {
    vi.mocked(concluirComando).mockResolvedValue(true);
    const r = await postResultado(
      requisicao(JSON.stringify({ situacao: "falhou", erro: "sem rede" })),
      contexto("c1"),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(concluirComando).toHaveBeenCalledWith("c1", { situacao: "falhou", erro: "sem rede" });
  });
});
