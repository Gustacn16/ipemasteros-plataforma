import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { ErroNegocio } from "@/lib/erros";

/**
 * Cifra dos links iCal da agenda pessoal (ADR 0005).
 * AES-256-GCM com chave derivada por HKDF de BETTER_AUTH_SECRET.
 * Formato: "v1.<iv>.<tag>.<dados>", cada parte em base64url.
 */

const VERSAO = "v1";
const MENSAGEM_INVALIDO = "Este link precisa ser colado de novo.";

function chave(): Buffer {
  const segredo = process.env.BETTER_AUTH_SECRET;
  if (!segredo) throw new Error("BETTER_AUTH_SECRET não configurado.");
  return Buffer.from(hkdfSync("sha256", segredo, "ipemaster-agenda", "agenda-externa:v1", 32));
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [VERSAO, iv, tag, dados].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decifrar(cifrado: string): string {
  const k = chave();
  const partes = cifrado.split(".");
  if (partes.length !== 4 || partes[0] !== VERSAO) throw new ErroNegocio(MENSAGEM_INVALIDO);
  const [iv, tag, dados] = partes.slice(1).map((p) => Buffer.from(p, "base64url"));
  if (iv.length !== 12 || tag.length !== 16) throw new ErroNegocio(MENSAGEM_INVALIDO);
  try {
    const decifra = createDecipheriv("aes-256-gcm", k, iv, { authTagLength: 16 });
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(dados), decifra.final()]).toString("utf8");
  } catch {
    throw new ErroNegocio(MENSAGEM_INVALIDO);
  }
}
