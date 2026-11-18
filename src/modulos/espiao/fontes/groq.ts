// Transcrição dos Reels pelo Groq (whisper-large-v3-turbo). Sem "server-only" para testar com fetch falso.
import { ErroNegocio } from "@/lib/erros";

const URL_GROQ = "https://api.groq.com/openai/v1/audio/transcriptions";
const LIMITE_VIDEO = 25 * 1024 * 1024;
const TEMPO_LIMITE_VIDEO_MS = 60_000;
const TEMPO_LIMITE_GROQ_MS = 120_000;
/** US$ 0,04 por hora de áudio, mínimo de 10 s por pedido. */
const MICRO_USD_POR_HORA = 40_000;

export function custoGroqMicroUsd(segundos: number): number {
  return Math.ceil((Math.max(segundos, 10) * MICRO_USD_POR_HORA) / 3600);
}

export function criarClienteGroq(chave: string, fetchFn: typeof fetch = fetch) {
  return {
    async transcrever(video: Blob, nomeArquivo: string): Promise<{ texto: string; segundos: number }> {
      const corpo = new FormData();
      corpo.set("file", video, nomeArquivo);
      corpo.set("model", "whisper-large-v3-turbo");
      corpo.set("language", "pt");
      corpo.set("response_format", "verbose_json");
      let resposta: Response;
      try {
        resposta = await fetchFn(URL_GROQ, {
          method: "POST",
          body: corpo,
          headers: { Authorization: `Bearer ${chave}` },
          signal: AbortSignal.timeout(TEMPO_LIMITE_GROQ_MS),
        });
      } catch {
        throw new ErroNegocio("Falha na transcrição");
      }
      const json = (await resposta.json().catch(() => null)) as { text?: string; duration?: number } | null;
      if (!resposta.ok || typeof json?.text !== "string") throw new ErroNegocio("Falha na transcrição");
      return { texto: json.text.trim(), segundos: typeof json.duration === "number" ? json.duration : 0 };
    },
  };
}

export type ClienteGroq = ReturnType<typeof criarClienteGroq>;

function daMeta(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && (host.endsWith(".cdninstagram.com") || host.endsWith(".fbcdn.net"));
}

/** Baixa o vídeo do Reels só da CDN da Meta; acima de 25 MB (≈ 3 min) devolve "grande_demais" sem guardar. */
export async function baixarVideo(url: string, fetchFn: typeof fetch = fetch): Promise<Blob | "grande_demais"> {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    throw new ErroNegocio("Endereço de vídeo não permitido");
  }
  if (!daMeta(destino)) throw new ErroNegocio("Endereço de vídeo não permitido");
  let resposta: Response;
  try {
    resposta = await fetchFn(destino.toString(), { signal: AbortSignal.timeout(TEMPO_LIMITE_VIDEO_MS), cache: "no-store" });
  } catch {
    throw new ErroNegocio("Não foi possível baixar o vídeo");
  }
  if (!resposta.ok || !resposta.body) throw new ErroNegocio("Não foi possível baixar o vídeo");
  const declarado = Number(resposta.headers.get("content-length") ?? 0);
  if (declarado > LIMITE_VIDEO) {
    await resposta.body.cancel();
    return "grande_demais";
  }
  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_VIDEO) {
      await leitor.cancel();
      return "grande_demais";
    }
    partes.push(value);
  }
  return new Blob(partes as BlobPart[], { type: resposta.headers.get("content-type") ?? "video/mp4" });
}
