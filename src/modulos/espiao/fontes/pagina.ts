// Download de páginas externas com bloqueio de rede interna (ADR "download de URLs externas").
// Sem "server-only" para testar com fetch e DNS falsos.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ErroNegocio } from "@/lib/erros";
import { extrairPrecos, extrairTextoVisivel } from "../regras/texto";

const LIMITE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECIONAMENTOS = 3;
const TEMPO_LIMITE_MS = 15_000;
const MINIMO_LEGIVEL = 300;
const USER_AGENT = "Mozilla/5.0 (compatible; leitor-paginas/1.0)";

type Deps = { fetchFn?: typeof fetch; resolver?: (host: string) => Promise<string[]> };

const resolverPadrao = async (host: string) => (await lookup(host, { all: true })).map((r) => r.address);

function ipv4Privado(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
}

/** Endereço interno, local ou reservado: nunca é buscado. */
export function ipPrivado(ip: string): boolean {
  const versao = isIP(ip);
  if (versao === 4) return ipv4Privado(ip);
  if (versao !== 6) return true;
  const baixo = ip.toLowerCase();
  const mapeado = baixo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return ipv4Privado(mapeado[1]);
  if (baixo === "::1" || baixo === "::") return true;
  return /^f[cd]/.test(baixo) || /^fe[89ab]/.test(baixo);
}

async function validarDestino(url: URL, resolver: NonNullable<Deps["resolver"]>): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ErroNegocio("Endereço não permitido");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let enderecos: string[];
  try {
    enderecos = isIP(host) ? [host] : await resolver(host);
  } catch {
    throw new ErroNegocio("Não foi possível abrir a página");
  }
  if (enderecos.length === 0 || enderecos.some(ipPrivado)) throw new ErroNegocio("Endereço não permitido");
}

async function lerCorpo(resposta: Response): Promise<string> {
  const leitor = resposta.body?.getReader();
  if (!leitor) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_BYTES) {
      await leitor.cancel();
      throw new ErroNegocio("Página grande demais");
    }
    partes.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(partes));
}

/** Baixa o HTML de uma URL pública: só http(s), sem rede interna (também após redirecionar), até 2 MB e 15 s. */
export async function baixarPagina(url: string, deps: Deps = {}): Promise<{ urlFinal: string; html: string }> {
  const fetchFn = deps.fetchFn ?? fetch;
  const resolver = deps.resolver ?? resolverPadrao;
  let atual: URL;
  try {
    atual = new URL(url);
  } catch {
    throw new ErroNegocio("Endereço não permitido");
  }
  for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
    await validarDestino(atual, resolver);
    let resposta: Response;
    try {
      resposta = await fetchFn(atual.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        cache: "no-store",
      });
    } catch (erro) {
      if (erro instanceof Error && erro.name === "TimeoutError") throw new ErroNegocio("A página demorou demais");
      throw new ErroNegocio("Não foi possível abrir a página");
    }
    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get("location");
      if (!destino) throw new ErroNegocio("Não foi possível abrir a página");
      atual = new URL(destino, atual);
      continue;
    }
    if (!resposta.ok) throw new ErroNegocio("Não foi possível abrir a página");
    return { urlFinal: atual.toString(), html: await lerCorpo(resposta) };
  }
  throw new ErroNegocio("Não foi possível abrir a página");
}

/** Texto visível, legibilidade (≥ 300 caracteres) e preços de uma página. */
export async function lerPagina(url: string, deps: Deps = {}): Promise<{ urlFinal: string; texto: string; legivel: boolean; precos: string[] }> {
  const { urlFinal, html } = await baixarPagina(url, deps);
  const texto = extrairTextoVisivel(html);
  return { urlFinal, texto, legivel: texto.length >= MINIMO_LEGIVEL, precos: extrairPrecos(texto) };
}
