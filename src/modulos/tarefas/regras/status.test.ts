import { describe, expect, it } from "vitest";
import { STATUS_PADRAO, concluidaEmAoMudarStatus, validarConjuntoStatus } from "./status";

describe("status padrão", () => {
  it("cria A fazer, Em andamento e Concluído, nessa ordem", () => {
    expect(STATUS_PADRAO.map((s) => [s.nome, s.tipo])).toEqual([
      ["A fazer", "aberto"],
      ["Em andamento", "em_andamento"],
      ["Concluído", "concluido"],
    ]);
  });
});

describe("validarConjuntoStatus", () => {
  it("aceita conjunto com aberto e concluído", () => {
    expect(validarConjuntoStatus(["aberto", "em_andamento", "concluido"])).toBeNull();
  });

  it("recusa conjunto sem concluído", () => {
    expect(validarConjuntoStatus(["aberto", "em_andamento"])).toMatch(/concluído/);
  });

  it("recusa conjunto sem aberto", () => {
    expect(validarConjuntoStatus(["em_andamento", "concluido"])).toMatch(/aberto/);
  });
});

describe("concluidaEmAoMudarStatus", () => {
  const agora = new Date("2026-11-27T15:00:00Z");
  const antes = new Date("2026-11-20T10:00:00Z");

  it("grava a data ao entrar em concluído", () => {
    expect(concluidaEmAoMudarStatus("concluido", null, agora)).toEqual(agora);
  });

  it("mantém a data original se já estava concluída", () => {
    expect(concluidaEmAoMudarStatus("concluido", antes, agora)).toEqual(antes);
  });

  it("limpa a data ao sair de concluído", () => {
    expect(concluidaEmAoMudarStatus("em_andamento", antes, agora)).toBeNull();
    expect(concluidaEmAoMudarStatus("aberto", antes, agora)).toBeNull();
  });
});
