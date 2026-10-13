import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token aleatório para links (convite etc.). Vai só no link; no banco fica o hash. */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparação em tempo constante, para segredos vindos de formulário. */
export function segredosIguais(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}
