import { describe, expect, it } from "vitest";
import { itensPessoais, rotuloLeitura, type EventoPessoalBruto } from "./pessoal";

const agendas = [{ id: "a1", nome: "Pessoal", cor: "#16a34a" }];

function ev(inicio: string, fim: string, diaInteiro = false, extra: Partial<EventoPessoalBruto> = {}): EventoPessoalBruto {
  return { agendaId: "a1", uid: "u1", titulo: "Dentista", inicio: new Date(inicio), fim: new Date(fim), diaInteiro, local: null, ...extra };
}

describe("itensPessoais", () => {
  it("converte hora UTC para São Paulo (UTC−3)", () => {
    const [i] = itensPessoais([ev("2026-11-03T13:00:00Z", "2026-11-03T14:30:00Z")], agendas);
    expect(i).toMatchObject({ tipo: "pessoal", href: null, inicio: "2026-11-03", fim: "2026-11-03", horaInicio: "10:00", horaFim: "11:30", cor: "#16a34a" });
  });

  it("evento de madrugada em UTC cai no dia anterior em São Paulo", () => {
    const [i] = itensPessoais([ev("2026-11-04T01:00:00Z", "2026-11-04T02:00:00Z")], agendas);
    expect(i).toMatchObject({ inicio: "2026-11-03", horaInicio: "22:00", horaFim: "23:00" });
  });

  it("dia inteiro: fim exclusivo vira o dia anterior", () => {
    // meia-noite de São Paulo = 03:00 UTC
    const [um] = itensPessoais([ev("2026-11-05T03:00:00Z", "2026-11-06T03:00:00Z", true)], agendas);
    expect(um).toMatchObject({ inicio: "2026-11-05", fim: "2026-11-05", horaInicio: null, horaFim: null });
    const [tres] = itensPessoais([ev("2026-11-05T03:00:00Z", "2026-11-08T03:00:00Z", true)], agendas);
    expect(tres).toMatchObject({ inicio: "2026-11-05", fim: "2026-11-07" });
  });

  it("dia inteiro sem duração não termina antes de começar", () => {
    const [i] = itensPessoais([ev("2026-11-05T03:00:00Z", "2026-11-05T03:00:00Z", true)], agendas);
    expect(i).toMatchObject({ inicio: "2026-11-05", fim: "2026-11-05" });
  });

  it("termina à meia-noite: fica no mesmo dia até 24:00", () => {
    const [i] = itensPessoais([ev("2026-11-04T02:00:00Z", "2026-11-04T03:00:00Z")], agendas);
    expect(i).toMatchObject({ inicio: "2026-11-03", fim: "2026-11-03", horaInicio: "23:00", horaFim: "24:00" });
  });

  it("com hora em vários dias vira faixa", () => {
    const [i] = itensPessoais([ev("2026-11-03T23:00:00Z", "2026-11-05T13:00:00Z")], agendas);
    expect(i).toMatchObject({ inicio: "2026-11-03", fim: "2026-11-05", horaInicio: "20:00", horaFim: "10:00" });
  });

  it("sem duração fica sem hora final", () => {
    const [i] = itensPessoais([ev("2026-11-03T13:00:00Z", "2026-11-03T13:00:00Z")], agendas);
    expect(i).toMatchObject({ horaInicio: "10:00", horaFim: null });
  });

  it("ids únicos por ocorrência, detalhe com agenda e local, descarta agenda desconhecida", () => {
    const itens = itensPessoais(
      [
        ev("2026-11-03T13:00:00Z", "2026-11-03T14:00:00Z", false, { local: "Clínica" }),
        ev("2026-11-10T13:00:00Z", "2026-11-10T14:00:00Z"),
        ev("2026-11-10T13:00:00Z", "2026-11-10T14:00:00Z", false, { agendaId: "outra" }),
      ],
      agendas,
    );
    expect(itens).toHaveLength(2);
    expect(new Set(itens.map((i) => i.id)).size).toBe(2);
    expect(itens[0].detalhe).toBe("Pessoal · Clínica");
  });
});

describe("rotuloLeitura", () => {
  const agora = new Date("2026-11-02T18:00:00Z"); // 15:00 em São Paulo
  it("hoje mostra só a hora de São Paulo", () => {
    expect(rotuloLeitura(new Date("2026-11-02T12:05:00Z"), agora)).toBe("Lida às 09:05");
  });
  it("outro dia mostra a data", () => {
    expect(rotuloLeitura(new Date("2026-11-02T02:30:00Z"), agora)).toBe("Lida em 01/11 às 23:30");
  });
  it("nunca lida", () => {
    expect(rotuloLeitura(null, agora)).toBeNull();
  });
});
