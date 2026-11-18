import { describe, expect, it } from "vitest";
import { descreverErro } from "./descrever-erro";

describe("descreverErro", () => {
  it("traz nome, código do Prisma e código do banco, sem a mensagem", () => {
    const erro = Object.assign(new Error("Access denied for user 'fulano' valor secreto"), {
      name: "PrismaClientKnownRequestError",
      code: "P2039",
      meta: { driverAdapterError: { cause: { kind: "mysql", originalCode: "45028", originalMessage: "valor secreto" } } },
    });
    const texto = descreverErro(erro);
    expect(texto).toBe("PrismaClientKnownRequestError P2039 mysql:45028");
    expect(texto).not.toContain("secreto");
  });

  it("erro comum mostra só o nome", () => {
    expect(descreverErro(new TypeError("x"))).toBe("TypeError");
  });

  it("valor que não é erro mostra o tipo", () => {
    expect(descreverErro("texto")).toBe("string");
  });

  it("ignora código fora do formato esperado", () => {
    const erro = Object.assign(new Error("m"), { code: "dado do aluno" });
    expect(descreverErro(erro)).toBe("Error");
  });
});
