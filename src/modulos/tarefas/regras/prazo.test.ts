import { describe, expect, it } from "vitest";
import { datasValidas, diaDaDataEntrega, diaEmSaoPaulo, grupoDaEntrega } from "./prazo";

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
