import { describe, expect, it } from "vitest";
import {
  baldesDoIntervalo,
  distribuirPorBalde,
  faixaPercentual,
  intervaloAnterior,
  podio,
  variacao,
  variacaoPontos,
  linhaVazia,
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

describe("intervaloAnterior", () => {
  const dias = (i: { periodo: string; primeiroDia: string; ultimoDia: string }) => [i.periodo, i.primeiroDia, i.ultimoDia];
  const agora = brasilia("2026-11-04T10:00:00");

  it("semana: os 7 dias antes", () => {
    const i = intervaloDoPeriodo({ periodo: "semana" }, brasilia("2026-11-02T10:00:00"));
    expect(dias(intervaloAnterior(i))).toEqual(["semana", "2026-10-26", "2026-11-01"]);
  });

  it("mes: o mês anterior inteiro", () => {
    expect(dias(intervaloAnterior(intervaloDoPeriodo({ periodo: "mes" }, agora)))).toEqual(["mes", "2026-10-01", "2026-10-31"]);
  });

  it("mes em janeiro: dezembro do ano anterior", () => {
    const i = intervaloDoPeriodo({ periodo: "mes" }, brasilia("2027-01-15T10:00:00"));
    expect(dias(intervaloAnterior(i))).toEqual(["mes", "2026-12-01", "2026-12-31"]);
  });

  it("mes_passado: o mês antes dele", () => {
    const i = intervaloDoPeriodo({ periodo: "mes_passado" }, agora);
    expect(dias(intervaloAnterior(i))).toEqual(["mes_passado", "2026-09-01", "2026-09-30"]);
  });

  it("intervalo: os N dias imediatamente antes", () => {
    const i = intervaloDoPeriodo({ periodo: "intervalo", de: "2026-11-10", ate: "2026-11-19" }, agora);
    const a = intervaloAnterior(i);
    expect(dias(a)).toEqual(["intervalo", "2026-10-31", "2026-11-09"]);
    expect(a.inicio.toISOString()).toBe("2026-10-31T03:00:00.000Z");
    expect(a.fim.toISOString()).toBe("2026-11-10T03:00:00.000Z");
  });
});

describe("variacao", () => {
  it("calcula a variação percentual inteira", () => {
    expect(variacao(12, 10)).toBe(20);
    expect(variacao(0, 4)).toBe(-100);
  });
  it("devolve null sem base de comparação", () => {
    expect(variacao(5, 0)).toBeNull();
  });
});

describe("variacaoPontos", () => {
  it("diferença em pontos percentuais", () => {
    expect(variacaoPontos(80, 75)).toBe(5);
  });
  it("null se algum lado é null", () => {
    expect(variacaoPontos(null, 75)).toBeNull();
    expect(variacaoPontos(80, null)).toBeNull();
  });
});

describe("baldesDoIntervalo", () => {
  it("novembro de 2026 dá 6 semanas recortadas ao mês", () => {
    const baldes = baldesDoIntervalo(intervaloDoPeriodo({ periodo: "mes" }, brasilia("2026-11-04T10:00:00")));
    expect(baldes).toHaveLength(6);
    expect(baldes[0]).toEqual({ inicio: "2026-11-01", fim: "2026-11-01", rotulo: "01/11" });
    expect(baldes[1]).toEqual({ inicio: "2026-11-02", fim: "2026-11-08", rotulo: "02/11" });
    expect(baldes[5]).toEqual({ inicio: "2026-11-30", fim: "2026-11-30", rotulo: "30/11" });
  });

  it("acima de 13 semanas agrupa por mês", () => {
    const i = intervaloDoPeriodo({ periodo: "intervalo", de: "2026-01-01", ate: "2026-12-31" }, brasilia("2026-12-31T10:00:00"));
    const baldes = baldesDoIntervalo(i);
    expect(baldes).toHaveLength(12);
    expect(baldes[0]).toEqual({ inicio: "2026-01-01", fim: "2026-01-31", rotulo: "jan/26" });
    expect(baldes[11]).toEqual({ inicio: "2026-12-01", fim: "2026-12-31", rotulo: "dez/26" });
  });

  it("recorta o primeiro e o último mês ao intervalo", () => {
    const i = intervaloDoPeriodo({ periodo: "intervalo", de: "2026-01-15", ate: "2027-01-10" }, brasilia("2027-01-10T10:00:00"));
    const baldes = baldesDoIntervalo(i);
    expect(baldes[0]).toEqual({ inicio: "2026-01-15", fim: "2026-01-31", rotulo: "jan/26" });
    expect(baldes.at(-1)).toEqual({ inicio: "2027-01-01", fim: "2027-01-10", rotulo: "jan/27" });
  });
});

describe("distribuirPorBalde", () => {
  const baldes = baldesDoIntervalo(intervaloDoPeriodo({ periodo: "mes" }, brasilia("2026-11-04T10:00:00")));

  it("decide o balde pelo dia de São Paulo, não pelo dia UTC", () => {
    // 23h de 08/11 em Brasília já é 09/11 em UTC.
    const r = distribuirPorBalde([{ dataEntrega: dia("2026-11-08"), concluidaEm: brasilia("2026-11-08T23:00:00") }], baldes);
    expect(r.find((b) => b.rotulo === "02/11")).toEqual({ rotulo: "02/11", noPrazo: 1, atrasadas: 0, semData: 0 });
    expect(r.find((b) => b.rotulo === "09/11")).toEqual({ rotulo: "09/11", noPrazo: 0, atrasadas: 0, semData: 0 });
  });

  it("separa no prazo, atrasadas e sem data", () => {
    const r = distribuirPorBalde(
      [
        { dataEntrega: dia("2026-11-09"), concluidaEm: brasilia("2026-11-10T10:00:00") },
        { dataEntrega: null, concluidaEm: brasilia("2026-11-10T10:00:00") },
        { dataEntrega: dia("2026-11-10"), concluidaEm: brasilia("2026-11-10T10:00:00") },
      ],
      baldes,
    );
    expect(r.find((b) => b.rotulo === "09/11")).toEqual({ rotulo: "09/11", noPrazo: 1, atrasadas: 1, semData: 1 });
  });
});

describe("podio", () => {
  const linha = (nome: string, noPrazo: number, percentual: number | null) => ({ ...linhaVazia({ id: nome, nome }), noPrazo, percentual });

  it("empate em noPrazo desempata por percentual", () => {
    expect(podio([linha("Ana", 5, 70), linha("Bia", 5, 90)]).map((l) => l.pessoa.nome)).toEqual(["Bia", "Ana"]);
  });
  it("percentual null fica por último", () => {
    expect(podio([linha("Ana", 5, null), linha("Bia", 5, 10)]).map((l) => l.pessoa.nome)).toEqual(["Bia", "Ana"]);
  });
  it("empate total ordena por nome", () => {
    expect(podio([linha("Carla", 4, 80), linha("Ana", 4, 80), linha("Bia", 4, 80)]).map((l) => l.pessoa.nome)).toEqual(["Ana", "Bia", "Carla"]);
  });
  it("deixa de fora quem tem noPrazo 0", () => {
    expect(podio([linha("Ana", 0, null), linha("Bia", 1, 100)]).map((l) => l.pessoa.nome)).toEqual(["Bia"]);
  });
  it("devolve no máximo 3", () => {
    expect(podio([1, 2, 3, 4, 5].map((n) => linha(`P${n}`, n, 50)))).toHaveLength(3);
  });
});
