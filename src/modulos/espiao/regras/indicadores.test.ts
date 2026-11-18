import { describe, expect, it } from "vitest";
import { calcularIndicadores } from "./indicadores";

const AGORA = new Date("2026-11-18T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000);

describe("calcularIndicadores", () => {
  it("seguidores, variação, posts por semana e engajamento médio", () => {
    const r = calcularIndicadores({
      concorrente: "X",
      fotos: [
        { seguidores: 1100, capturadaEm: diasAtras(0) },
        { seguidores: 1000, capturadaEm: diasAtras(7) },
      ],
      midias: [
        { publicadoEm: diasAtras(1), curtidas: 10, comentarios: 1 },
        { publicadoEm: diasAtras(10), curtidas: 30, comentarios: 3 },
        { publicadoEm: diasAtras(20), curtidas: null, comentarios: 9 },
        { publicadoEm: diasAtras(40), curtidas: 999, comentarios: 0 },
      ],
      destaques: ["Reels com 4× a média do perfil"],
      agora: AGORA,
    });
    expect(r).toEqual({
      concorrente: "X",
      seguidores: 1100,
      variacaoSeguidores: 0.1,
      postsPorSemana: 0.75,
      engajamentoMedio: 2,
      destaques: ["Reels com 4× a média do perfil"],
    });
  });

  it("sem fotos e sem mídias, devolve nulos", () => {
    expect(calcularIndicadores({ concorrente: "Y", fotos: [], midias: [], destaques: [], agora: AGORA })).toEqual({
      concorrente: "Y", seguidores: null, variacaoSeguidores: null, postsPorSemana: 0, engajamentoMedio: null, destaques: [],
    });
  });
});
