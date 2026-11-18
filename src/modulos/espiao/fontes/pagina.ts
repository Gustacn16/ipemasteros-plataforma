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
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 || // multicast, reservado e broadcast
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && ip.split(".")[2] === "0") ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** IPv6 em 16 bytes (aceita "::" e IPv4 pontuado no fim); null se inválido. */
function bytesIpv6(ip: string): number[] | null {
  let texto = ip.toLowerCase().split("%")[0];
  const v4 = texto.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const p = v4[1].split(".").map(Number);
    texto = `${texto.slice(0, -v4[1].length)}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const [esq, dir, ...resto] = texto.split("::");
  if (resto.length) return null;
  const a = esq ? esq.split(":") : [];
  const b = dir !== undefined ? (dir ? dir.split(":") : []) : null;
  const grupos = b === null ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  if (grupos.length !== 8) return null;
  return grupos.flatMap((g) => {
    const n = Number.parseInt(g || "0", 16);
    return [(n >> 8) & 0xff, n & 0xff];
  });
}

/** Endereço interno, local ou reservado: nunca é buscado. */
export function ipPrivado(ip: string): boolean {
  const versao = isIP(ip);
  if (versao === 4) return ipv4Privado(ip);
  if (versao !== 6) return true;
  const b = bytesIpv6(ip);
  if (!b) return true;
  const zerados = (ate: number) => b.slice(0, ate).every((x) => x === 0);
  const v4Embutido = () => ipv4Privado(b.slice(12).join("."));
  if (zerados(16)) return true; // ::
  if (zerados(15) && b[15] === 1) return true; // ::1
  if (zerados(10) && b[10] === 0xff && b[11] === 0xff) return v4Embutido(); // ::ffff:a.b.c.d
  if (zerados(12)) return v4Embutido(); // ::a.b.c.d (compatível)
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return true; // 64:ff9b::/96 (NAT64)
  if (b[0] === 0x20 && b[1] === 0x02) return true; // 2002::/16 (6to4)
  if (b[0] === 0xff) return true; // multicast
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10
  return false;
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
