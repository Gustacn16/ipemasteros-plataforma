import { describe, expect, it } from "vitest";
import { esquemaFiltrosDashboard } from "./dashboard";

const agora = new Date("2026-11-15T12:00:00Z");

describe("esquemaFiltrosDashboard", () => {
  it("mês inválido cai no atual; filtros vazios ficam de fora", () => {
    expect(esquemaFiltrosDashboard(agora).parse({ mes: "abc", produto: "", vendedor: "" })).toEqual({
      mes: "2026-11",
      produto: undefined,
      vendedor: undefined,
    });
  });

  it("mantém mês e filtros válidos", () => {
    expect(esquemaFiltrosDashboard(agora).parse({ mes: "2026-10", produto: "p1", vendedor: "u1" })).toEqual({
      mes: "2026-10",
      produto: "p1",
      vendedor: "u1",
    });
  });
});
