import { describe, expect, it } from "vitest";
import { validarLancamento } from "./lancamento";

describe("validarLancamento", () => {
  it("recusa mês que ainda não começou", () => {
    expect(validarLancamento({ mes: "2027-04", hoje: "2027-03-31", fonte: "manual" })).toBe("Não dá para lançar um mês que ainda não começou.");
  });
  it("aceita o mês atual em indicador manual", () => {
    expect(validarLancamento({ mes: "2027-03", hoje: "2027-03-31", fonte: "manual" })).toBeNull();
  });
  it("recusa indicador automático", () => {
    expect(validarLancamento({ mes: "2027-03", hoje: "2027-03-31", fonte: "meta_leads" })).toBe("Este número vem sozinho da plataforma.");
  });
});
