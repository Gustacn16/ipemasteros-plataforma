import { describe, expect, it } from "vitest";
import { datasValidas, diaDaDataEntrega, diaEmSaoPaulo, grupoDaEntrega, rotuloChipPrazo, situacaoEntrega } from "./prazo";

// Datas @db.Date chegam do Prisma como meia-noite UTC do dia.
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("dias em São Paulo", () => {
  it("22h de 27/11 em Brasília ainda é dia 27, mesmo já sendo 28 em UTC", () => {
    expect(diaEmSaoPaulo(new Date("2026-11-28T01:00:00Z"))).toBe("2026-11-27");
  });

  it("data de entrega usa o próprio dia salvo", () => {
    expect(diaDaDataEntrega(dia("2026-11-27"))).toBe("2026-11-27");
  });
});

describe("grupoDaEntrega (Minhas tarefas)", () => {
  const agora = new Date("2026-11-28T01:00:00Z"); // 27/11, 22h em Brasília

  it("entrega hoje fica em Hoje até o fim do dia de Brasília", () => {
    expect(grupoDaEntrega(dia("2026-11-27"), agora)).toBe("hoje");
  });

  it("entrega de ontem é atrasada", () => {
    expect(grupoDaEntrega(dia("2026-11-26"), agora)).toBe("atrasadas");
  });

  it("até 7 dias à frente fica em Próximos 7 dias", () => {
    expect(grupoDaEntrega(dia("2026-11-28"), agora)).toBe("proximos7");
    expect(grupoDaEntrega(dia("2026-12-04"), agora)).toBe("proximos7");
  });

  it("depois de 7 dias fica em Depois", () => {
    expect(grupoDaEntrega(dia("2026-12-05"), agora)).toBe("depois");
  });

  it("sem data fica em Sem data", () => {
    expect(grupoDaEntrega(null, agora)).toBe("sem_data");
  });
});

describe("datasValidas", () => {
  it("aceita início antes ou igual à entrega, ou datas faltando", () => {
    expect(datasValidas(dia("2026-11-20"), dia("2026-11-27"))).toBe(true);
    expect(datasValidas(dia("2026-11-27"), dia("2026-11-27"))).toBe(true);
    expect(datasValidas(null, dia("2026-11-27"))).toBe(true);
    expect(datasValidas(dia("2026-11-27"), null)).toBe(true);
  });

  it("recusa início depois da entrega", () => {
    expect(datasValidas(dia("2026-11-28"), dia("2026-11-27"))).toBe(false);
  });
});

describe("situacaoEntrega (cartão)", () => {
  // 02/11 às 22h em São Paulo = 03/11 01h UTC: o dia ainda é 02/11.
  const agora = new Date("2026-11-03T01:00:00Z");
  const dia = (d: string) => new Date(`${d}T00:00:00Z`);

  it("classifica pelo dia de São Paulo", () => {
    expect(situacaoEntrega(dia("2026-10-30"), null, agora)).toEqual({ tom: "atrasada", dias: -3 });
    expect(situacaoEntrega(dia("2026-11-02"), null, agora)).toEqual({ tom: "hoje", dias: 0 });
    expect(situacaoEntrega(dia("2026-11-03"), null, agora)).toEqual({ tom: "amanha", dias: 1 });
    expect(situacaoEntrega(dia("2026-11-09"), null, agora)).toEqual({ tom: "proxima", dias: 7 });
    expect(situacaoEntrega(dia("2026-11-10"), null, agora)).toEqual({ tom: "futura", dias: 8 });
  });

  it("tarefa concluída nunca fica atrasada", () => {
    expect(situacaoEntrega(dia("2026-10-30"), agora, agora).tom).toBe("concluida");
  });
});

describe("rotuloChipPrazo", () => {
  const agora = new Date("2026-11-27T15:00:00Z");
  const rotulo = (entrega: string, concluida: Date | null = null) =>
    rotuloChipPrazo(situacaoEntrega(dia(entrega), concluida, agora), dia(entrega));

  it("atrasada 1 dia (singular)", () => {
    expect(rotulo("2026-11-26")).toEqual({ texto: "Atrasada 1 dia", tom: "perigo" });
  });
  it("atrasada 3 dias (plural)", () => {
    expect(rotulo("2026-11-24")).toEqual({ texto: "Atrasada 3 dias", tom: "perigo" });
  });
  it("hoje", () => {
    expect(rotulo("2026-11-27")).toEqual({ texto: "Vence hoje", tom: "atencao" });
  });
  it("amanhã", () => {
    expect(rotulo("2026-11-28")).toEqual({ texto: "Vence amanhã", tom: "atencao" });
  });
  it("próxima, em 4 dias", () => {
    expect(rotulo("2026-12-01")).toEqual({ texto: "Em 4 dias", tom: "informacao" });
  });
  it("futura mostra a data curta", () => {
    expect(rotulo("2026-12-20")).toEqual({ texto: "20/12", tom: "neutro" });
  });
  it("concluída vence o atraso", () => {
    expect(rotulo("2026-11-24", new Date("2026-11-25T12:00:00Z"))).toEqual({ texto: "Concluída", tom: "sucesso" });
  });
});
