import { DisconnectReason } from "baileys";
import { describe, expect, it } from "vitest";
import { motivoDoFechamento } from "./conexoes.ts";

describe("motivoDoFechamento", () => {
  it("aparelho removido no celular apaga a sessão", () => {
    expect(motivoDoFechamento(DisconnectReason.loggedOut)).toBe("removido_no_celular");
  });

  it("queda comum reconecta", () => {
    expect(motivoDoFechamento(DisconnectReason.connectionClosed)).toBe("reconectar");
  });

  it("sem código também reconecta", () => {
    expect(motivoDoFechamento(undefined)).toBe("reconectar");
  });
});
