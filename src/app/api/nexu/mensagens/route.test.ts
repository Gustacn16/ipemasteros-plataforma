import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";

const m = vi.hoisted(() => ({ obterUsuarioAtual: vi.fn(), exigirPermissao: vi.fn(), executarPergunta: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/sessao", () => ({ obterUsuarioAtual: m.obterUsuarioAtual, exigirPermissao: m.exigirPermissao }));
vi.mock("@/modulos/nexu/servicos/executar-pergunta", () => ({ executarPergunta: m.executarPergunta }));

import { POST } from "./route";

const usuario = { id: "u1", papel: "ADMIN" };
const pedido = (corpo: unknown) =>
  new Request("http://localhost/api/nexu/mensagens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
const valido = { conversaId: null, pergunta: "Oi", tela: "/inicio" };

beforeEach(() => {
  vi.resetAllMocks();
  m.obterUsuarioAtual.mockResolvedValue(usuario);
  m.exigirPermissao.mockResolvedValue(usuario);
});

describe("POST /api/nexu/mensagens", () => {
  it("sem sessão devolve 401", async () => {
    m.obterUsuarioAtual.mockResolvedValue(null);
    expect((await POST(pedido(valido))).status).toBe(401);
  });

  it("sem permissão devolve 403", async () => {
    m.exigirPermissao.mockRejectedValue(new ErroPermissao("nexu:usar"));
    expect((await POST(pedido(valido))).status).toBe(403);
  });

  it("corpo inválido devolve 400", async () => {
    expect((await POST(pedido({ conversaId: null, pergunta: "  ", tela: null }))).status).toBe(400);
    expect((await POST(pedido("não é json"))).status).toBe(400);
  });

  it("transmite os eventos como SSE", async () => {
    m.executarPergunta.mockImplementation(async function* () {
      yield { tipo: "conversa", conversaId: "c1" };
      yield { tipo: "fim", restantesHoje: 49 };
    });
    const r = await POST(pedido(valido));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    expect(r.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(r.headers.get("x-accel-buffering")).toBe("no");
    expect(await r.text()).toBe(
      `data: ${JSON.stringify({ tipo: "conversa", conversaId: "c1" })}\n\ndata: ${JSON.stringify({ tipo: "fim", restantesHoje: 49 })}\n\n`,
    );
  });

  it("erro inesperado vira um evento de erro e fecha", async () => {
    m.executarPergunta.mockImplementation(async function* () {
      yield { tipo: "texto", texto: "a" };
      throw new Error("segredo interno");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const texto = await (await POST(pedido(valido))).text();
    expect(texto).toContain(JSON.stringify({ tipo: "erro", mensagem: "O Nexu está indisponível agora, tente de novo em instantes." }));
    expect(texto).not.toContain("segredo interno");
  });

  it("cancelar a leitura chama return() do gerador", async () => {
    const retorno = vi.fn();
    const gerador = {
      next: vi.fn(() => new Promise(() => {})),
      return: retorno.mockResolvedValue({ done: true, value: undefined }),
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    m.executarPergunta.mockReturnValue(gerador);
    const r = await POST(pedido(valido));
    const leitor = r.body!.getReader();
    void leitor.read();
    await leitor.cancel();
    expect(retorno).toHaveBeenCalled();
  });
});
