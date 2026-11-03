import { describe, expect, it } from "vitest";
import {
  mesAnterior,
  mesAtual,
  mesSeguinte,
  metaVazia,
  metasParaCopiar,
  primeiroDiaDoMes,
  rotuloMes,
  totaisMetas,
  vendedoresParaValidar,
} from "./meta";

describe("meses", () => {
  it("anterior e seguinte atravessam o ano", () => {
    expect(mesAnterior("2027-01")).toBe("2026-12");
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(mesAnterior("2026-11")).toBe("2026-10");
  });

  it("mês atual segue o calendário de São Paulo", () => {
    // 22h de 30/11 em Brasília já é 01/12 em UTC.
    expect(mesAtual(new Date("2026-12-01T01:00:00Z"))).toBe("2026-11");
  });

  it("primeiro dia e rótulo", () => {
    expect(primeiroDiaDoMes("2026-11")).toBe("2026-11-01");
    expect(rotuloMes("2026-11")).toBe("novembro de 2026");
  });
});

describe("metaVazia", () => {
  it("só quando valor e quantidade são zero", () => {
    expect(metaVazia({ valorAlvo: "0.00", quantidadeAlvo: 0 })).toBe(true);
    expect(metaVazia({ valorAlvo: "0.00", quantidadeAlvo: 1 })).toBe(false);
    expect(metaVazia({ valorAlvo: "100.00", quantidadeAlvo: 0 })).toBe(false);
  });
});

describe("metasParaCopiar", () => {
  const anteriores = [
    { produtoId: "p1", vendedorId: "ana", valorAlvo: "360000.00", quantidadeAlvo: 5 },
    { produtoId: "p1", vendedorId: "bia", valorAlvo: "100000.00", quantidadeAlvo: 2 },
    { produtoId: "p-inativo", vendedorId: "ana", valorAlvo: "5000.00", quantidadeAlvo: 1 },
    { produtoId: "p1", vendedorId: "saiu", valorAlvo: "1000.00", quantidadeAlvo: 1 },
  ];
  const ativos = { produtos: ["p1"], vendedores: ["ana", "bia"] };

  it("copia as que faltam, com os mesmos valores", () => {
    expect(metasParaCopiar(anteriores, [], ativos)).toEqual(anteriores.slice(0, 2));
  });

  it("não repete a que já existe no mês e ignora produto e vendedor inativos", () => {
    expect(metasParaCopiar(anteriores, [{ produtoId: "p1", vendedorId: "ana" }], ativos)).toEqual([anteriores[1]]);
  });
});

describe("totaisMetas", () => {
  it("soma em centavos por produto, por vendedor e no geral", () => {
    const t = totaisMetas([
      { produtoId: "p1", vendedorId: "ana", valorAlvo: "0.10", quantidadeAlvo: 1 },
      { produtoId: "p1", vendedorId: "bia", valorAlvo: "0.20", quantidadeAlvo: 2 },
      { produtoId: "p2", vendedorId: "ana", valorAlvo: "1.00", quantidadeAlvo: 3 },
    ]);
    expect(t.porProduto.p1).toEqual({ valor: "0.30", quantidade: 3 });
    expect(t.porVendedor.ana).toEqual({ valor: "1.10", quantidade: 4 });
    expect(t.geral).toEqual({ valor: "1.30", quantidade: 6 });
  });
});

describe("vendedoresParaValidar", () => {
  it("só confere vendedores das linhas preenchidas (linha vazia de quem saiu não trava o salvar)", () => {
    expect(
      vendedoresParaValidar([
        { vendedorId: "ana", valorAlvo: "100.00", quantidadeAlvo: 1 },
        { vendedorId: "saiu", valorAlvo: "0.00", quantidadeAlvo: 0 },
        { vendedorId: "ana", valorAlvo: "0.00", quantidadeAlvo: 2 },
      ]),
    ).toEqual(["ana"]);
  });
});
