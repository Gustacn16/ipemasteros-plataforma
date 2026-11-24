import { describe, expect, it } from "vitest";
import { avisoEditavel, paraCampoDataHora, ROTULO_SITUACAO_AVISO, rotuloEnvio } from "./aviso-tela";

describe("aviso-tela", () => {
  it("rótulos das situações", () => {
    expect(ROTULO_SITUACAO_AVISO).toEqual({
      rascunho: "Rascunho",
      aprovado: "Aprovado",
      enviando: "Enviando",
      concluido: "Enviado",
      cancelado: "Cancelado",
      falhou: "Não enviado",
    });
  });
  it("só rascunho e aprovado editam", () => {
    expect(avisoEditavel("rascunho")).toBe(true);
    expect(avisoEditavel("aprovado")).toBe(true);
    expect(avisoEditavel("enviando")).toBe(false);
    expect(avisoEditavel("concluido")).toBe(false);
  });
  it("datetime-local no horário de São Paulo", () => {
    expect(paraCampoDataHora(new Date("2026-11-25T12:00:00.000Z"))).toBe("2026-11-25T09:00");
    expect(paraCampoDataHora(new Date("2026-11-25T02:30:00.000Z"))).toBe("2026-11-24T23:30");
  });
  it("rótulo de cada envio", () => {
    expect(rotuloEnvio("enviado", null)).toBe("✓ enviado");
    expect(rotuloEnvio("falhou", "grupo saiu")).toBe("✗ falhou (grupo saiu)");
    expect(rotuloEnvio("falhou", null)).toBe("✗ falhou");
    expect(rotuloEnvio("sem_numero", null)).toBe("sem número para enviar");
  });
});
