import { describe, expect, it } from "vitest";
import { filtroEventosVisiveis, podeVerInstitucional } from "./visibilidade";

describe("filtroEventosVisiveis", () => {
  it("admin vê todos os não excluídos", () => {
    expect(filtroEventosVisiveis("admin")).toEqual({ excluidoEm: null });
  });
  it("professor vê só os liberados para professores", () => {
    expect(filtroEventosVisiveis("professor")).toEqual({ excluidoEm: null, visivelProfessores: true });
  });
  it("aluno não vê nada", () => {
    expect(filtroEventosVisiveis("aluno")).toEqual({ id: { in: [] } });
  });
});

describe("podeVerInstitucional", () => {
  it("admin e professor sim, aluno não", () => {
    expect(podeVerInstitucional("admin")).toBe(true);
    expect(podeVerInstitucional("professor")).toBe(true);
    expect(podeVerInstitucional("aluno")).toBe(false);
  });
});
