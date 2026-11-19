import { describe, expect, it } from "vitest";
import { esquemaDocumento, esquemaIndicador, esquemaMedicao } from "./processos";

describe("esquemas de Processos", () => {
  it("documento: vazios viram null e revisão em meses", () => {
    const d = esquemaDocumento.parse({ areaId: "a", tipo: "processo", titulo: "Captura de lead", resumo: "", revisarACadaMeses: "6" });
    expect(d.resumo).toBeNull();
    expect(d.revisarACadaMeses).toBe(6);
    expect(esquemaDocumento.safeParse({ areaId: "a", tipo: "processo", titulo: "X1", revisarACadaMeses: "0" }).success).toBe(false);
  });

  it("indicador aceita meta em formato brasileiro", () => {
    const i = esquemaIndicador.parse({ nome: "Taxa de conversão", unidade: "%", sentido: "maior_melhor", meta: "12,5", frequencia: "mensal" });
    expect(i.meta).toBe(12.5);
    expect(i.responsavelId).toBeNull();
  });

  it("medição: mês vira o dia 1 e valor é obrigatório", () => {
    expect(esquemaMedicao.parse({ periodo: "2026-11", valor: "10" }).periodo).toBe("2026-11-01");
    expect(esquemaMedicao.safeParse({ periodo: "2026-11", valor: "" }).success).toBe(false);
  });
});
