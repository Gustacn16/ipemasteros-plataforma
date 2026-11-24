import { describe, expect, it } from "vitest";
import { textoDaFalha } from "./erro-envio.ts";

describe("textoDaFalha", () => {
  it("enviar_grupo deixa passar só as duas mensagens conhecidas", () => {
    expect(textoDaFalha("enviar_grupo", "Número não está conectado.", "Error")).toBe("Número não está conectado.");
    expect(textoDaFalha("enviar_grupo", "Destino não é um grupo.", "Error")).toBe("Destino não é um grupo.");
  });

  it("enviar_grupo com outro erro devolve só o nome, sem a mensagem", () => {
    expect(textoDaFalha("enviar_grupo", "item-not-found 120363@g.us 5511999990000", "Boom")).toBe("Falha ao enviar (Boom)");
  });

  it("conectar e desconectar mantêm a mensagem cortada em 255", () => {
    expect(textoDaFalha("conectar", "x".repeat(300), "Error")).toHaveLength(255);
    expect(textoDaFalha("desconectar", "falhou", "Error")).toBe("falhou");
  });
});
