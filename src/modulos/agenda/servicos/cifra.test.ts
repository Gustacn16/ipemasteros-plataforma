import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ErroNegocio } from "@/lib/erros";
import { cifrar, decifrar } from "./cifra";

const URL_TESTE = "https://calendar.google.com/calendar/ical/ficticio%40gmail.com/private-000/basic.ics";

describe("cifra dos links", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "segredo-ficticio-so-para-teste-0123456789");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ida e volta devolve o texto original", () => {
    const c = cifrar(URL_TESTE);
    expect(c).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(c).not.toContain("calendar");
    expect(decifrar(c)).toBe(URL_TESTE);
  });

  it("dois cifrar do mesmo texto são diferentes", () => {
    expect(cifrar(URL_TESTE)).not.toBe(cifrar(URL_TESTE));
  });

  it("trocar um caractere dos dados dá erro de colar de novo", () => {
    const c = cifrar(URL_TESTE);
    const partes = c.split(".");
    const dados = partes[3];
    partes[3] = (dados[0] === "A" ? "B" : "A") + dados.slice(1);
    const adulterado = partes.join(".");
    expect(() => decifrar(adulterado)).toThrow(ErroNegocio);
    expect(() => decifrar(adulterado)).toThrow("Este link precisa ser colado de novo.");
  });

  it("formato inválido dá erro de colar de novo", () => {
    for (const ruim of ["", "v2.a.b.c", "v1.a.b", "qualquer coisa"]) {
      expect(() => decifrar(ruim)).toThrow("Este link precisa ser colado de novo.");
    }
  });

  it("outro BETTER_AUTH_SECRET não decifra", () => {
    const c = cifrar(URL_TESTE);
    vi.stubEnv("BETTER_AUTH_SECRET", "outro-segredo-ficticio-9876543210");
    expect(() => decifrar(c)).toThrow("Este link precisa ser colado de novo.");
  });

  it("sem BETTER_AUTH_SECRET lança erro", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(() => cifrar(URL_TESTE)).toThrow();
    expect(() => cifrar(URL_TESTE)).not.toThrow(ErroNegocio);
  });
});
