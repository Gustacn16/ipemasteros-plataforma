import { describe, expect, it } from "vitest";
import { esquemaFiltrosRelatorio } from "./relatorio";

describe("esquemaFiltrosRelatorio", () => {
  it("sem filtros, o período é este mês", () => {
    expect(esquemaFiltrosRelatorio.parse({}).periodo).toBe("mes");
  });

  it("período ou data inválidos viram o padrão", () => {
    const filtros = esquemaFiltrosRelatorio.parse({ periodo: "ano", de: "10/10/2026", ate: "2026-10-20" });
    expect(filtros).toMatchObject({ periodo: "mes", de: undefined, ate: "2026-10-20" });
  });
});
