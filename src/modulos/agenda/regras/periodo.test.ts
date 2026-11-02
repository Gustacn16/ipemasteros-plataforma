import { describe, expect, it } from "vitest";
import {
  diasDaSemana,
  faixasDaSemana,
  instanteFim,
  instanteInicio,
  navegar,
  ordenarLote,
  periodoPadraoFimDeSemana,
  titulosDoLote,
  validarPeriodo,
  type Periodo,
} from "./periodo";

function p(dataInicio: string, dataFim: string, horaInicio: string | null = null, horaFim: string | null = null): Periodo {
  return { dataInicio, dataFim, horaInicio, horaFim };
}

describe("validarPeriodo", () => {
  it("aceita dia inteiro de um dia", () => {
    expect(validarPeriodo(p("2026-11-07", "2026-11-07"))).toBeNull();
  });
  it("aceita 30/12/2026 a 02/01/2027", () => {
    expect(validarPeriodo(p("2026-12-30", "2027-01-02"))).toBeNull();
  });
  it("recusa fim antes do início", () => {
    expect(validarPeriodo(p("2026-11-07", "2026-11-06"))).toBe("A data final não pode ser antes da inicial.");
  });
  it("aceita 31 dias e recusa 32", () => {
    expect(validarPeriodo(p("2026-03-01", "2026-03-31"))).toBeNull();
    expect(validarPeriodo(p("2026-03-01", "2026-04-01"))).toBe("Um evento dura no máximo 31 dias.");
  });
  it("recusa só uma hora", () => {
    expect(validarPeriodo(p("2026-11-07", "2026-11-07", "10:00", null))).toBe("Informe as duas horas ou nenhuma.");
    expect(validarPeriodo(p("2026-11-07", "2026-11-07", null, "10:00"))).toBe("Informe as duas horas ou nenhuma.");
  });
  it("recusa 10:00 a 09:00 no mesmo dia, mas aceita 22:00 a 02:00 em dias diferentes", () => {
    expect(validarPeriodo(p("2026-11-07", "2026-11-07", "10:00", "09:00"))).toBe("A hora final precisa ser depois da inicial.");
    expect(validarPeriodo(p("2026-11-07", "2026-11-08", "22:00", "02:00"))).toBeNull();
  });
  it('recusa "24:00"', () => {
    expect(validarPeriodo(p("2026-11-07", "2026-11-08", "10:00", "24:00"))).toBe("Hora inválida.");
  });
});

describe("ordenarLote", () => {
  it("ordena por data de início", () => {
    const r = ordenarLote([p("2026-03-14", "2026-03-14"), p("2026-03-07", "2026-03-07"), p("2026-03-21", "2026-03-21")]);
    expect(r.map((x) => x.dataInicio)).toEqual(["2026-03-07", "2026-03-14", "2026-03-21"]);
  });
  it("desempata pela hora de início", () => {
    const r = ordenarLote([p("2026-03-07", "2026-03-07", "15:00", "16:00"), p("2026-03-07", "2026-03-07", "09:00", "10:00")]);
    expect(r.map((x) => x.horaInicio)).toEqual(["09:00", "15:00"]);
  });
});

describe("titulosDoLote", () => {
  it("numera com travessão", () => {
    expect(titulosDoLote("Módulo", 3, true)).toEqual(["Módulo — 1", "Módulo — 2", "Módulo — 3"]);
  });
  it("repete o título sem numerar", () => {
    expect(titulosDoLote("Módulo", 3, false)).toEqual(["Módulo", "Módulo", "Módulo"]);
  });
});

describe("periodoPadraoFimDeSemana", () => {
  it("de uma quarta, devolve o sábado e o domingo seguintes", () => {
    expect(periodoPadraoFimDeSemana("2026-11-04")).toEqual({ dataInicio: "2026-11-07", dataFim: "2026-11-08" });
  });
  it("de um sábado, devolve ele mesmo", () => {
    expect(periodoPadraoFimDeSemana("2026-11-07")).toEqual({ dataInicio: "2026-11-07", dataFim: "2026-11-08" });
  });
});

describe("instantes", () => {
  it("início com hora converte de São Paulo para UTC", () => {
    expect(instanteInicio(p("2026-11-07", "2026-11-08", "22:00", "02:00")).toISOString()).toBe("2026-11-08T01:00:00.000Z");
  });
  it("fim de dia inteiro é a meia-noite do dia seguinte em SP", () => {
    expect(instanteFim(p("2026-11-07", "2026-11-08")).toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });
  it("início de dia inteiro é a meia-noite em SP", () => {
    expect(instanteInicio(p("2026-11-07", "2026-11-08")).toISOString()).toBe("2026-11-07T03:00:00.000Z");
  });
  it("fim com hora usa o dia final e a hora final", () => {
    expect(instanteFim(p("2026-11-07", "2026-11-08", "22:00", "02:00")).toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });
});

describe("diasDaSemana", () => {
  it("devolve domingo a sábado que contém o dia", () => {
    expect(diasDaSemana("2026-11-04")).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07",
    ]);
  });
});

describe("faixasDaSemana", () => {
  const semana = diasDaSemana("2026-12-27");
  it("posiciona evento de 30/12 a 02/01", () => {
    const [f] = faixasDaSemana(semana, [{ id: "a", inicio: "2026-12-30", fim: "2027-01-02" }]);
    expect(f).toMatchObject({ coluna: 3, largura: 4, linha: 0, continuaAntes: false, continuaDepois: false });
  });
  it("não aparece na semana anterior", () => {
    const anterior = diasDaSemana("2026-12-20");
    expect(faixasDaSemana(anterior, [{ id: "a", inicio: "2026-12-30", fim: "2027-01-02" }])).toEqual([]);
  });
  it("eventos sobrepostos ficam em linhas 0 e 1", () => {
    const fs = faixasDaSemana(semana, [
      { id: "a", inicio: "2026-12-28", fim: "2026-12-29" },
      { id: "b", inicio: "2026-12-29", fim: "2026-12-30" },
    ]);
    expect(fs.map((f) => [f.item.id, f.linha])).toEqual([["a", 0], ["b", 1]]);
  });
  it("eventos sem sobreposição dividem a linha 0", () => {
    const fs = faixasDaSemana(semana, [
      { id: "a", inicio: "2026-12-28", fim: "2026-12-28" },
      { id: "b", inicio: "2026-12-29", fim: "2026-12-30" },
    ]);
    expect(fs.map((f) => f.linha)).toEqual([0, 0]);
  });
  it("evento que começa antes da semana continua antes", () => {
    const [f] = faixasDaSemana(semana, [{ id: "a", inicio: "2026-12-20", fim: "2026-12-28" }]);
    expect(f).toMatchObject({ coluna: 0, largura: 2, continuaAntes: true, continuaDepois: false });
  });
  it("evento que termina depois da semana continua depois", () => {
    const [f] = faixasDaSemana(semana, [{ id: "a", inicio: "2027-01-01", fim: "2027-01-10" }]);
    expect(f).toMatchObject({ coluna: 5, largura: 2, continuaAntes: false, continuaDepois: true });
  });
  it("o maior vem primeiro quando começam no mesmo dia", () => {
    const fs = faixasDaSemana(semana, [
      { id: "curto", inicio: "2026-12-28", fim: "2026-12-28" },
      { id: "longo", inicio: "2026-12-28", fim: "2026-12-31" },
    ]);
    expect(fs.map((f) => [f.item.id, f.linha])).toEqual([["longo", 0], ["curto", 1]]);
  });
});

describe("navegar", () => {
  it("mês: vai para o dia 1 do mês vizinho", () => {
    expect(navegar("mes", "2026-01-31", 1)).toBe("2026-02-01");
    expect(navegar("mes", "2026-01-15", -1)).toBe("2025-12-01");
  });
  it("semana: soma ou subtrai 7 dias", () => {
    expect(navegar("semana", "2026-12-28", 1)).toBe("2027-01-04");
    expect(navegar("semana", "2026-12-28", -1)).toBe("2026-12-21");
  });
  it("lista: 60 dias", () => {
    expect(navegar("lista", "2026-11-01", 1)).toBe("2026-12-31");
    expect(navegar("lista", "2026-11-01", -1)).toBe("2026-09-02");
  });
});
