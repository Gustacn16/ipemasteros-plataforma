import { describe, expect, it } from "vitest";
import { gerarToken, hashToken, segredosIguais } from "./tokens";

describe("tokens", () => {
  it("gera tokens longos, únicos e seguros para URL", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hash é determinístico e não revela o token", () => {
    const token = gerarToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toContain(token);
  });

  it("compara segredos de tamanhos diferentes sem lançar erro", () => {
    expect(segredosIguais("abc", "abc")).toBe(true);
    expect(segredosIguais("abc", "abcd")).toBe(false);
  });
});
