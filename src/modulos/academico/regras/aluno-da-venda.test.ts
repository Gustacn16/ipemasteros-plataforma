import { describe, expect, it } from "vitest";
import { acharAlunoDaVenda, mesmoTelefone } from "./aluno-da-venda";

describe("mesmoTelefone", () => {
  it("ignora o 55 e recusa vazio", () => {
    expect(mesmoTelefone("62999990000", "5562999990000")).toBe(true);
    expect(mesmoTelefone("62999990000", "62888880000")).toBe(false);
    expect(mesmoTelefone(null, "62999990000")).toBe(false);
    expect(mesmoTelefone(null, null)).toBe(false);
  });
});

describe("acharAlunoDaVenda", () => {
  const ana = { id: "a", nomeBusca: "ana silva", telefone: "62999990000" };
  const anaSemFone = { id: "b", nomeBusca: "ana silva", telefone: null };
  const outra = { id: "c", nomeBusca: "maria", telefone: "5562777770000" };

  it("telefone vence o nome", () => {
    expect(acharAlunoDaVenda([ana, outra], { nomeBusca: "maria souza", whatsapp: "62777770000" })).toBe(outra);
  });

  it("homônimo com telefone diferente é outra pessoa", () => {
    expect(acharAlunoDaVenda([ana], { nomeBusca: "ana silva", whatsapp: "62111110000" })).toBeNull();
  });

  it("homônimo sem telefone é a mesma pessoa", () => {
    expect(acharAlunoDaVenda([ana, anaSemFone], { nomeBusca: "ana silva", whatsapp: "62111110000" })).toBe(anaSemFone);
  });

  it("cliente sem WhatsApp acha pelo nome", () => {
    expect(acharAlunoDaVenda([ana], { nomeBusca: "ana silva", whatsapp: null })).toBe(ana);
  });
});
