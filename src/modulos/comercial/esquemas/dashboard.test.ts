import { describe, expect, it } from "vitest";
import { esquemaFiltrosDashboard } from "./dashboard";

const agora = new Date("2026-11-15T12:00:00Z");

describe("esquemaFiltrosDashboard", () => {
  it("mês inválido cai no atual; filtros vazios ficam de fora", () => {
    expect(esquemaFiltrosDashboard(agora).parse({ mes: "abc", produto: "", vendedor: "" })).toMatchObject({
      mes: "2026-11",
      produto: undefined,
      vendedor: undefined,
    });
  });

  it("mantém mês e filtros válidos", () => {
    expect(esquemaFiltrosDashboard(agora).parse({ mes: "2026-10", produto: "p1", vendedor: "u1" })).toMatchObject({
      mes: "2026-10",
      produto: "p1",
      vendedor: "u1",
    });
  });
});

describe("filtros da visão Mídia", () => {
  const ler = (v: Record<string, string | undefined>) => esquemaFiltrosDashboard(agora).parse(v);

  it("visão: vendas por padrão; midia quando pedido", () => {
    expect(ler({}).visao).toBe("vendas");
    expect(ler({ visao: "xyz" }).visao).toBe("vendas");
    expect(ler({ visao: "midia" }).visao).toBe("midia");
  });

  it("campanhas a partir de uma lista separada por vírgula, sem repetir e sem vazios", () => {
    expect(ler({ campanhas: "c1,c2,,c1" }).campanhas).toEqual(["c1", "c2"]);
    expect(ler({}).campanhas).toEqual([]);
  });

  it("situação inválida vira todas; busca vazia some", () => {
    expect(ler({ situacao: "abc" }).situacao).toBe("todas");
    expect(ler({ situacao: "pausadas" }).situacao).toBe("pausadas");
    expect(ler({ busca: "  " }).busca).toBeUndefined();
    expect(ler({ busca: " Capilar " }).busca).toBe("Capilar");
  });
});

describe("filtro de categoria", () => {
  it("aceita as categorias conhecidas e ignora o resto", () => {
    expect(esquemaFiltrosDashboard(agora).parse({ categoria: "psiquiatria" }).categoria).toBe("psiquiatria");
    expect(esquemaFiltrosDashboard(agora).parse({ categoria: "xyz" }).categoria).toBeUndefined();
    expect(esquemaFiltrosDashboard(agora).parse({}).categoria).toBeUndefined();
  });
});
