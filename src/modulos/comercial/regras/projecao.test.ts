import { describe, expect, it } from "vitest";
import { diasNoMes, projetarMes, type EntradaProjecao } from "./projecao";

const R = (reais: number) => reais * 100;

// 6 meses de base: 60 vendas, 1.200 leads (5% de conversão), R$ 1,2 mi vendidos (ticket R$ 20 mil).
const historico = Array.from({ length: 6 }, (_, i) => ({ mes: `2026-0${i + 5}`, vendido: R(200_000), vendas: 10, leads: 200 }));

const entrada = (parcial: Partial<EntradaProjecao> = {}): EntradaProjecao => ({
  mes: "2026-11",
  hoje: "2026-11-15",
  vendido: R(150_000),
  vendas: 6,
  meta: R(400_000),
  leads: 100,
  historico,
  ...parcial,
});

describe("diasNoMes", () => {
  it("conta fevereiro, meses de 30 e de 31", () => {
    expect(diasNoMes("2026-02")).toBe(28);
    expect(diasNoMes("2028-02")).toBe(29);
    expect(diasNoMes("2026-11")).toBe(30);
    expect(diasNoMes("2026-12")).toBe(31);
  });
});

describe("projetarMes", () => {
  it("no mês em andamento, projeta pelos leads e mostra o ritmo ao lado", () => {
    const p = projetarMes(entrada());
    expect(p).toMatchObject({ situacao: "andamento", diasDoMes: 30, diasPassados: 15, diasRestantes: 15 });
    expect(p.base).toMatchObject({ meses: 6, vendas: 60, leads: 1200, conversao: 0.05, ticket: R(20_000) });
    // Ritmo: 150 mil em 15 dias → 300 mil no mês.
    expect(p.ritmo).toBe(R(300_000));
    // Leads: 100 em 15 dias → 200 no mês; 100 a mais × 5% = 5 vendas × 20 mil = 100 mil.
    expect(p.leads).toBe(100);
    expect(p.leadsProjetados).toBe(200);
    expect(p.pelosLeads).toBe(R(250_000));
    expect(p.vendasProjetadas).toBe(11);
    expect(p).toMatchObject({ valor: R(250_000), origem: "leads", percentual: 63, diferenca: -R(150_000) });
    // Faltam 250 mil em 15 dias; 250 mil ÷ (5% × 20 mil) = 250 leads.
    expect(p.falta).toBe(R(250_000));
    expect(p.faltaPorDia).toBe(Math.ceil(R(250_000) / 15));
    expect(p.leadsNecessarios).toBe(250);
  });

  it("sem leads (sem permissão de mídia ou com filtro), fica só o ritmo", () => {
    const p = projetarMes(entrada({ leads: null }));
    expect(p).toMatchObject({ valor: R(300_000), origem: "ritmo", pelosLeads: null, leadsNecessarios: null, leadsProjetados: null });
  });

  it("base sem leads: conversão vazia, ticket pelas vendas, projeção pelo ritmo", () => {
    const semLeads = historico.map((h) => ({ ...h, leads: null }));
    const p = projetarMes(entrada({ historico: semLeads }));
    expect(p.base).toMatchObject({ meses: 0, conversao: null, ticket: R(20_000) });
    expect(p.origem).toBe("ritmo");
  });

  it("meses sem leads ficam fora da conversão", () => {
    const misto = [...historico.slice(0, 3).map((h) => ({ ...h, leads: 0 })), ...historico.slice(3)];
    const p = projetarMes(entrada({ historico: misto }));
    expect(p.base).toMatchObject({ meses: 3, vendas: 30, leads: 600, conversao: 0.05 });
  });

  it("acima da meta: diferença positiva e nada falta", () => {
    const p = projetarMes(entrada({ vendido: R(450_000) }));
    expect(p.diferenca).toBeGreaterThan(0);
    expect(p).toMatchObject({ falta: 0, faltaPorDia: null, leadsNecessarios: null });
  });

  it("mês fechado mostra o vendido final", () => {
    const p = projetarMes(entrada({ mes: "2026-10", hoje: "2026-11-15", vendido: R(320_000) }));
    expect(p).toMatchObject({ situacao: "passado", valor: R(320_000), origem: "fechado", percentual: 80, ritmo: null, faltaPorDia: null });
  });

  it("mês futuro não tem projeção", () => {
    const p = projetarMes(entrada({ mes: "2026-12", vendido: 0, vendas: 0, leads: 0 }));
    expect(p).toMatchObject({ situacao: "futuro", valor: null, origem: null, percentual: null, diasPassados: 0 });
  });

  it("sem meta: projeção sem percentual", () => {
    const p = projetarMes(entrada({ meta: 0 }));
    expect(p).toMatchObject({ percentual: null, diferenca: null, falta: 0 });
  });
});
