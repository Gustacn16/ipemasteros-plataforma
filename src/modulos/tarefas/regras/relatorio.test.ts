import { describe, expect, it } from "vitest";
import {
  faixaPercentual,
  fimDoDiaEntrega,
  intervaloDoPeriodo,
  percentualNoPrazo,
  resumirPorPessoa,
  situacaoPrazo,
} from "./relatorio";

// Datas @db.Date chegam do Prisma como meia-noite UTC do dia.
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
// Horário de Brasília (UTC−3 fixo) convertido para o instante UTC.
const brasilia = (iso: string) => new Date(`${iso}-03:00`);

describe("fimDoDiaEntrega", () => {
  it("é 23:59:59.999 de Brasília, ou seja, 02:59:59.999 UTC do dia seguinte", () => {
    expect(fimDoDiaEntrega(dia("2026-11-27")).toISOString()).toBe("2026-11-28T02:59:59.999Z");
  });
});

describe("situacaoPrazo (tarefa concluída)", () => {
  const agora = brasilia("2026-12-10T10:00:00");

  it("concluída às 23h59 de Brasília no dia da entrega está no prazo", () => {
    expect(situacaoPrazo(dia("2026-11-27"), brasilia("2026-11-27T23:59:00"), agora)).toBe("no_prazo");
  });

  it("concluída às 00h01 de Brasília do dia seguinte está atrasada", () => {
    expect(situacaoPrazo(dia("2026-11-27"), brasilia("2026-11-28T00:01:00"), agora)).toBe("atrasada");
  });

  it("concluída antes da entrega está no prazo", () => {
    expect(situacaoPrazo(dia("2026-11-27"), brasilia("2026-11-20T09:00:00"), agora)).toBe("no_prazo");
  });

  it("sem data de entrega fica sem data", () => {
    expect(situacaoPrazo(null, brasilia("2026-11-27T10:00:00"), agora)).toBe("sem_data");
  });
});

describe("situacaoPrazo (tarefa aberta)", () => {
  const agora = brasilia("2026-11-27T22:00:00"); // já é 28/11 em UTC

  it("entrega hoje ainda está no prazo", () => {
    expect(situacaoPrazo(dia("2026-11-27"), null, agora)).toBe("no_prazo");
  });

  it("entrega ontem está atrasada", () => {
    expect(situacaoPrazo(dia("2026-11-26"), null, agora)).toBe("atrasada");
  });

  it("sem data fica sem data", () => {
    expect(situacaoPrazo(null, null, agora)).toBe("sem_data");
  });
});

describe("percentualNoPrazo e faixa de cor", () => {
  it("sem divisor não tem percentual", () => {
    expect(percentualNoPrazo(0, 0)).toBeNull();
    expect(faixaPercentual(null)).toBeNull();
  });

  it("arredonda para inteiro", () => {
    expect(percentualNoPrazo(2, 3)).toBe(67);
  });

  it("verde a partir de 80, amarelo de 60 a 79, vermelho abaixo de 60", () => {
    expect(faixaPercentual(100)).toBe("verde");
    expect(faixaPercentual(80)).toBe("verde");
    expect(faixaPercentual(79)).toBe("amarelo");
    expect(faixaPercentual(60)).toBe("amarelo");
    expect(faixaPercentual(59)).toBe("vermelho");
    expect(faixaPercentual(0)).toBe("vermelho");
  });
});

describe("intervaloDoPeriodo", () => {
  // Terça-feira, 03/11/2026, 22h em Brasília (já é quarta em UTC).
  const agora = brasilia("2026-11-03T22:00:00");

  it("este mês vai do dia 1 à meia-noite de Brasília até o fim do mês", () => {
    const i = intervaloDoPeriodo({ periodo: "mes" }, agora);
    expect(i.primeiroDia).toBe("2026-11-01");
    expect(i.ultimoDia).toBe("2026-11-30");
    expect(i.inicio.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(i.fim.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("mês passado", () => {
    const i = intervaloDoPeriodo({ periodo: "mes_passado" }, agora);
    expect(i.primeiroDia).toBe("2026-10-01");
    expect(i.ultimoDia).toBe("2026-10-31");
  });

  it("mês passado em janeiro volta para dezembro do ano anterior", () => {
    const i = intervaloDoPeriodo({ periodo: "mes_passado" }, brasilia("2027-01-15T12:00:00"));
    expect(i.primeiroDia).toBe("2026-12-01");
    expect(i.ultimoDia).toBe("2026-12-31");
  });

  it("esta semana vai de segunda a domingo", () => {
    const i = intervaloDoPeriodo({ periodo: "semana" }, agora);
    expect(i.primeiroDia).toBe("2026-11-02");
    expect(i.ultimoDia).toBe("2026-11-08");
  });

  it("no domingo, a semana começa na segunda anterior", () => {
    const i = intervaloDoPeriodo({ periodo: "semana" }, brasilia("2026-11-08T23:00:00"));
    expect(i.primeiroDia).toBe("2026-11-02");
  });

  it("intervalo livre inclui o último dia inteiro", () => {
    const i = intervaloDoPeriodo({ periodo: "intervalo", de: "2026-10-10", ate: "2026-10-20" }, agora);
    expect(i.inicio.toISOString()).toBe("2026-10-10T03:00:00.000Z");
    expect(i.fim.toISOString()).toBe("2026-10-21T03:00:00.000Z");
  });

  it("intervalo livre incompleto ou invertido volta para este mês", () => {
    expect(intervaloDoPeriodo({ periodo: "intervalo", de: "2026-10-10" }, agora).periodo).toBe("mes");
    expect(intervaloDoPeriodo({ periodo: "intervalo", de: "2026-10-20", ate: "2026-10-10" }, agora).periodo).toBe("mes");
  });
});

describe("resumirPorPessoa", () => {
  const agora = brasilia("2026-11-20T10:00:00");
  const ana = { id: "a", nome: "Ana" };
  const bruno = { id: "b", nome: "Bruno" };

  it("conta abertas, atrasadas, entregues e no prazo por pessoa", () => {
    const abertas = [
      { dataEntrega: dia("2026-11-19"), concluidaEm: null, responsaveis: [ana] }, // atrasada
      { dataEntrega: dia("2026-11-20"), concluidaEm: null, responsaveis: [ana] }, // hoje
      { dataEntrega: null, concluidaEm: null, responsaveis: [ana] },
    ];
    const entregues = [
      { dataEntrega: dia("2026-11-10"), concluidaEm: brasilia("2026-11-10T23:00:00"), responsaveis: [ana] },
      { dataEntrega: dia("2026-11-10"), concluidaEm: brasilia("2026-11-12T09:00:00"), responsaveis: [ana] },
      { dataEntrega: null, concluidaEm: brasilia("2026-11-12T09:00:00"), responsaveis: [ana] },
    ];
    const [linha] = resumirPorPessoa(abertas, entregues, agora);
    expect(linha).toEqual({
      pessoa: ana,
      abertas: 3,
      atrasadas: 1,
      entregues: 3,
      entreguesComData: 2,
      noPrazo: 1,
      percentual: 50,
    });
  });

  it("tarefa com vários responsáveis conta para cada um, e as linhas saem em ordem de nome", () => {
    const entregues = [{ dataEntrega: dia("2026-11-10"), concluidaEm: brasilia("2026-11-09T10:00:00"), responsaveis: [bruno, ana] }];
    const linhas = resumirPorPessoa([], entregues, agora);
    expect(linhas.map((l) => l.pessoa.nome)).toEqual(["Ana", "Bruno"]);
    expect(linhas.every((l) => l.noPrazo === 1 && l.percentual === 100)).toBe(true);
  });

  it("entregues só sem data deixam o percentual vazio", () => {
    const entregues = [{ dataEntrega: null, concluidaEm: brasilia("2026-11-09T10:00:00"), responsaveis: [ana] }];
    expect(resumirPorPessoa([], entregues, agora)[0]?.percentual).toBeNull();
  });
});
