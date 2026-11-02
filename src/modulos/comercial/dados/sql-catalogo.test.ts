import { describe, expect, it } from "vitest";
import { CATALOGO_PRODUTOS } from "./catalogo-produtos";
import { gerarSqlCatalogo, sqlTexto } from "./sql-catalogo";

describe("sqlTexto", () => {
  it("escapa aspas, barras e mantém quebras de linha", () => {
    expect(sqlTexto(null)).toBe("NULL");
    expect(sqlTexto("D'Ávila \\ x")).toBe("'D\\'Ávila \\\\ x'");
    expect(sqlTexto("linha 1\nlinha 2")).toBe("'linha 1\\nlinha 2'");
  });
});

describe("gerarSqlCatalogo", () => {
  const sql = gerarSqlCatalogo();

  it("só insere o que ainda não existe", () => {
    expect(sql).toContain("INSERT IGNORE INTO");
    expect(sql).not.toMatch(/INSERT INTO/);
  });

  it("inclui os 12 produtos e os 6 canais", () => {
    for (const p of CATALOGO_PRODUTOS) expect(sql).toContain(`'${p.id}'`);
    for (const c of ["Instagram", "Indicação", "Google", "WhatsApp", "Evento", "Outro"]) expect(sql).toContain(`'${c}'`);
  });

  it("é determinístico", () => {
    expect(gerarSqlCatalogo()).toBe(sql);
  });
});
