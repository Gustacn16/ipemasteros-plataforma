import { describe, expect, it } from "vitest";
import { CHAVES_META_CALCULADA, FONTES } from "./fontes";
import { INDICADORES_PADRAO, PREMISSAS_FUNIL_PADRAO } from "./indicadores-padrao";

describe("indicadores padrão", () => {
  it("tem os 9 do Comercial e os 13 do Marketing", () => {
    expect(INDICADORES_PADRAO).toHaveLength(22);
    expect(INDICADORES_PADRAO.filter((i) => i.frente === "comercial")).toHaveLength(9);
  });
  it("usa só chaves e fontes conhecidas", () => {
    for (const i of INDICADORES_PADRAO) {
      if (i.metaCalculada) expect(CHAVES_META_CALCULADA).toContain(i.metaCalculada);
      expect(FONTES).toContain(i.fonte);
    }
  });
  it("traz as premissas do funil da planilha", () => {
    expect(PREMISSAS_FUNIL_PADRAO).toEqual({
      convLeadAgendada: 0.2,
      comparecimento: 0.75,
      convReuniaoVenda: 0.25,
      custoPorLeadCentavos: 15_000,
      comissaoPct: 0.05,
      tetoCacPct: 0.1,
    });
  });
});

describe("paciente modelo", () => {
  it("tem indicador manual de pacientes modelo por mês no Comercial", () => {
    expect(INDICADORES_PADRAO.find((i) => i.nome === "Pacientes modelo")).toMatchObject({ frente: "comercial", fonte: "manual", metaCalculada: null, tipo: "fluxo" });
  });
});
