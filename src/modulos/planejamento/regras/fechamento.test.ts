import { describe, expect, it } from "vitest";
import { PREMISSAS_FUNIL_PADRAO } from "./indicadores-padrao";
import { escolherMetaDoMes, mesTravado, mesesParaCongelar, retratarMes } from "./fechamento";

const retratoA = retratarMes({ p: { alunos: 7, valorCentavos: 29_500_000 } }, PREMISSAS_FUNIL_PADRAO);
const retratoB = retratarMes({ p: { alunos: 9, valorCentavos: 34_800_000 } }, PREMISSAS_FUNIL_PADRAO);

describe("retratarMes", () => {
  it("guarda as metas por produto e o funil do total", () => {
    expect(retratoA.produtos.p.alunos).toBe(7);
    expect(retratoA.funil.leads).toBe(190);
  });
});

describe("escolherMetaDoMes", () => {
  it("mês fechado com retrato usa o retrato, não o plano atual", () => {
    expect(escolherMetaDoMes("2027-01", "2027-03-10", { "2027-01": retratoA }, retratoB)).toBe(retratoA);
  });
  it("mês atual usa o plano atual mesmo com retrato", () => {
    expect(escolherMetaDoMes("2027-03", "2027-03-10", { "2027-03": retratoA }, retratoB)).toBe(retratoB);
  });
  it("mês fechado sem retrato usa o plano atual", () => {
    expect(escolherMetaDoMes("2027-02", "2027-03-10", {}, retratoB)).toBe(retratoB);
  });
});

describe("mesesParaCongelar", () => {
  it("só os meses fechados do ano ainda sem retrato", () => {
    expect(mesesParaCongelar(2027, "2027-03-10", ["2027-01"])).toEqual(["2027-02"]);
  });
  it("antes do ano do plano, nada", () => expect(mesesParaCongelar(2027, "2026-11-23", [])).toEqual([]));
  it("depois do ano, os 12", () => expect(mesesParaCongelar(2027, "2028-02-01", [])).toHaveLength(12));
});

describe("plano criado com o ano em andamento", () => {
  it("meses fechados antes da criação do plano não são congelados", () => {
    expect(mesesParaCongelar(2026, "2026-12-05", [], "2026-11")).toEqual(["2026-11"]);
  });
  it("meses antes da criação continuam editáveis", () => {
    expect(mesTravado("2026-03", "2026-12-05", "2026-11")).toBe(false);
    expect(mesTravado("2026-11", "2026-12-05", "2026-11")).toBe(true);
    expect(mesTravado("2026-12", "2026-12-05", "2026-11")).toBe(false);
  });
});
