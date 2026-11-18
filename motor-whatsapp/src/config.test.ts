import { describe, expect, it } from "vitest";
import { resolverPastaSessoes } from "./trava.ts";

describe("resolverPastaSessoes", () => {
  it("sem valor, usa sessoes dentro da pasta do motor", () => {
    expect(resolverPastaSessoes(undefined, "/opt/motor")).toBe("/opt/motor/sessoes");
  });
  it("caminho relativo é resolvido a partir da pasta do motor", () => {
    expect(resolverPastaSessoes("./dados", "/opt/motor")).toBe("/opt/motor/dados");
  });
  it("caminho absoluto é mantido", () => {
    expect(resolverPastaSessoes("/var/sessoes", "/opt/motor")).toBe("/var/sessoes");
  });
});
