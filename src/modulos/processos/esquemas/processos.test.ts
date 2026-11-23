import { describe, expect, it } from "vitest";
import { esquemaDocumento } from "./processos";

describe("esquemas de Processos", () => {
  it("documento: vazios viram null e revisão em meses", () => {
    const d = esquemaDocumento.parse({ areaId: "a", tipo: "processo", titulo: "Captura de lead", resumo: "", revisarACadaMeses: "6" });
    expect(d.resumo).toBeNull();
    expect(d.revisarACadaMeses).toBe(6);
    expect(esquemaDocumento.safeParse({ areaId: "a", tipo: "processo", titulo: "X1", revisarACadaMeses: "0" }).success).toBe(false);
  });
});
