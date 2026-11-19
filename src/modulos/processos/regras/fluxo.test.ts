import { describe, expect, it } from "vitest";
import { destinoNao, destinoSim, lerFluxo, validarFluxo, type Etapa } from "./fluxo";

const e = (id: string, extra: Partial<Etapa> = {}): Etapa => ({
  id,
  tipo: "etapa",
  titulo: `Etapa ${id}`,
  descricao: "",
  responsavel: "",
  sim: null,
  nao: null,
  ...extra,
});

describe("fluxo", () => {
  it("decisão sem destino de Sim segue para a próxima etapa", () => {
    const etapas = [e("a"), e("b", { tipo: "decisao", nao: "a" }), e("c")];
    expect(destinoSim(etapas, 1)).toBe(2);
    expect(destinoNao(etapas, 1)).toBe(0);
  });

  it("remove destinos inexistentes, para si mesma e de etapas que não são decisão", () => {
    const etapas = validarFluxo([e("a", { sim: "b" }), e("b", { tipo: "decisao", sim: "x", nao: "b" })]);
    expect(etapas[0]!.sim).toBeNull();
    expect(etapas[1]!.sim).toBeNull();
    expect(etapas[1]!.nao).toBeNull();
  });

  it("recusa ids repetidos e mais de 30 etapas", () => {
    expect(() => validarFluxo([e("a"), e("a")])).toThrow();
    expect(() => validarFluxo(Array.from({ length: 31 }, (_, i) => e(String(i))))).toThrow();
  });

  it("fluxo inválido no banco vira lista vazia", () => {
    expect(lerFluxo({ nada: 1 })).toEqual([]);
    expect(lerFluxo(null)).toEqual([]);
  });
});
