import { describe, expect, it } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { baixarVideo, criarClienteGroq, custoGroqMicroUsd } from "./groq";

describe("custoGroqMicroUsd", () => {
  it("cobra no mínimo 10 s e arredonda para cima", () => {
    expect(custoGroqMicroUsd(5)).toBe(112);
    expect(custoGroqMicroUsd(90)).toBe(1000);
  });
});

describe("criarClienteGroq", () => {
  it("envia multipart com modelo, idioma e formato e devolve texto e duração", async () => {
    let corpo: FormData | null = null;
    let cabecalhos: Headers | null = null;
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
      corpo = init?.body as FormData;
      cabecalhos = new Headers(init?.headers);
      return new Response(JSON.stringify({ text: " Olá, residência. ", duration: 42.5 }), { status: 200 });
    }) as typeof fetch;
    const r = await criarClienteGroq("CHAVE", fetchFn).transcrever(new Blob(["x"], { type: "video/mp4" }), "m1.mp4");
    expect(r).toEqual({ texto: "Olá, residência.", segundos: 42.5 });
    const f = corpo as unknown as FormData;
    expect(f.get("model")).toBe("whisper-large-v3-turbo");
    expect(f.get("language")).toBe("pt");
    expect(f.get("response_format")).toBe("verbose_json");
    expect(f.get("file")).toBeInstanceOf(Blob);
    expect((cabecalhos as unknown as Headers).get("authorization")).toBe("Bearer CHAVE");
  });

  it("erro do Groq vira ErroNegocio sem repassar o original", async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ error: { message: "segredo" } }), { status: 401 })) as typeof fetch;
    const erro = await criarClienteGroq("C", fetchFn).transcrever(new Blob(["x"]), "a.mp4").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect(erro.message).toBe("Falha na transcrição");
  });
});

describe("baixarVideo", () => {
  const ok = (bytes: number) => (async () => new Response(new Uint8Array(bytes), { status: 200 })) as typeof fetch;
  it("só baixa da CDN da Meta, por https", async () => {
    await expect(baixarVideo("https://evil.com/v.mp4", ok(1))).rejects.toThrow("Endereço de vídeo não permitido");
    await expect(baixarVideo("http://scontent.cdninstagram.com/v.mp4", ok(1))).rejects.toThrow("Endereço de vídeo não permitido");
    await expect(baixarVideo("https://cdninstagram.com.evil.com/v.mp4", ok(1))).rejects.toThrow("Endereço de vídeo não permitido");
    await expect(baixarVideo("https://scontent-gru1.cdninstagram.com/v.mp4", ok(10))).resolves.toBeInstanceOf(Blob);
    await expect(baixarVideo("https://video.xx.fbcdn.net/v.mp4", ok(10))).resolves.toBeInstanceOf(Blob);
  });

  it("acima de 25 MB devolve grande_demais", async () => {
    await expect(baixarVideo("https://a.cdninstagram.com/v.mp4", ok(25 * 1024 * 1024 + 1))).resolves.toBe("grande_demais");
  });
});
