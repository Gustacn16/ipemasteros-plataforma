import { describe, expect, it } from "vitest";
import { REGRAS_PADRAO } from "../esquemas/regras-atendimento";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { eventosDaConversa, mediana, metricasDoDia, metricasDosDias, percentual, type MensagemTempo } from "./atendimento";

const r = REGRAS_PADRAO;
const d = (s: string) => new Date(`${s}-03:00`);
const H = 60 * 60 * 1000;
const cli = (s: string): MensagemTempo => ({ deMim: false, enviadaEm: d(s) });
const emp = (s: string): MensagemTempo => ({ deMim: true, enviadaEm: d(s) });
const mais = (data: Date, horas: number) => new Date(data.getTime() + horas * H);
const empEm = (data: Date): MensagemTempo => ({ deMim: true, enviadaEm: data });
const cliEm = (data: Date): MensagemTempo => ({ deMim: false, enviadaEm: data });

// 2026-11-18 é quarta-feira.
describe("eventosDaConversa: vezes", () => {
  it("cliente-cliente-empresa forma uma vez só, do primeiro cliente até a empresa", () => {
    const msgs = [cli("2026-11-18T10:00:00"), cli("2026-11-18T10:03:00"), emp("2026-11-18T10:09:00")];
    const { vezes } = eventosDaConversa(msgs, d("2026-11-18T12:00:00"), r);
    expect(vezes).toEqual([
      { inicio: d("2026-11-18T10:00:00"), respondidaEm: d("2026-11-18T10:09:00"), segundos: 540 },
    ]);
  });

  it("conversa só com mensagens da empresa não tem vez", () => {
    const msgs = [emp("2026-11-18T10:00:00"), emp("2026-11-18T11:00:00")];
    expect(eventosDaConversa(msgs, d("2026-11-18T12:00:00"), r).vezes).toEqual([]);
  });

  it("vez aberta conta segundos úteis até agora", () => {
    // quarta 17h50 até quinta 8h10: 10 min na quarta + 10 min na quinta
    const msgs = [cli("2026-11-18T17:50:00")];
    const { vezes } = eventosDaConversa(msgs, d("2026-11-19T08:10:00"), r);
    expect(vezes).toEqual([{ inicio: d("2026-11-18T17:50:00"), respondidaEm: null, segundos: 1200 }]);
  });

  it("empresa-cliente-empresa-cliente forma duas vezes", () => {
    const msgs = [
      emp("2026-11-18T09:00:00"),
      cli("2026-11-18T10:00:00"),
      emp("2026-11-18T10:05:00"),
      cli("2026-11-18T11:00:00"),
    ];
    const { vezes } = eventosDaConversa(msgs, d("2026-11-18T11:20:00"), r);
    expect(vezes).toEqual([
      { inicio: d("2026-11-18T10:00:00"), respondidaEm: d("2026-11-18T10:05:00"), segundos: 300 },
      { inicio: d("2026-11-18T11:00:00"), respondidaEm: null, segundos: 1200 },
    ]);
  });
});

describe("eventosDaConversa: follow-up", () => {
  const E = d("2026-11-18T10:00:00");

  it("empresa 10h, nada mais, agora +2 dias → follow-up pendente", () => {
    const { followups } = eventosDaConversa([empEm(E)], mais(E, 48), r);
    expect(followups).toEqual([{ devidoEm: mais(E, 24), resultado: "pendente" }]);
  });

  it("empresa 10h, empresa de novo +30 h → feito com devidoEm = +24 h", () => {
    const { followups } = eventosDaConversa([empEm(E), empEm(mais(E, 30))], mais(E, 31), r);
    expect(followups[0]).toEqual({ devidoEm: mais(E, 24), resultado: "feito" });
  });

  it("empresa 10h, cliente +30 h → cancelado", () => {
    const { followups } = eventosDaConversa([empEm(E), cliEm(mais(E, 30))], mais(E, 31), r);
    expect(followups).toEqual([{ devidoEm: mais(E, 24), resultado: "cancelado" }]);
  });

  it("empresa 10h, nada por 4 dias → perdido", () => {
    const { followups } = eventosDaConversa([empEm(E)], mais(E, 96), r);
    expect(followups).toEqual([{ devidoEm: mais(E, 24), resultado: "perdido" }]);
  });

  it("empresa 10h, empresa de novo depois de 4 dias → perdido", () => {
    const { followups } = eventosDaConversa([empEm(E), empEm(mais(E, 96))], mais(E, 97), r);
    expect(followups[0]).toEqual({ devidoEm: mais(E, 24), resultado: "perdido" });
  });

  it("empresa 10h, empresa de novo +2 h → sem follow-up para a primeira", () => {
    const { followups } = eventosDaConversa([empEm(E), empEm(mais(E, 2))], mais(E, 3), r);
    // só a segunda mensagem gera follow-up (pendente, devido em +2 h +24 h)
    expect(followups).toEqual([{ devidoEm: mais(E, 26), resultado: "pendente" }]);
  });

  it("próxima mensagem a exatas 24 h não cria follow-up", () => {
    const { followups } = eventosDaConversa([empEm(E), cliEm(mais(E, 24))], mais(E, 25), r);
    expect(followups).toEqual([]);
  });
});

describe("metricasDoDia", () => {
  it("vez que começa 23h50 e termina 0h10 conta no dia em que começou", () => {
    const conversas = [{ mensagens: [cli("2026-11-17T23:50:00"), emp("2026-11-18T00:10:00")] }];
    const agora = d("2026-11-18T09:00:00");
    const terca = metricasDoDia(conversas, "2026-11-17", agora, r);
    const quarta = metricasDoDia(conversas, "2026-11-18", agora, r);
    expect(terca.respostasSeg).toEqual([0]);
    expect(terca.primeirasRespostasSeg).toEqual([0]);
    expect(quarta.respostasSeg).toEqual([]);
    expect(quarta.primeirasRespostasSeg).toEqual([]);
  });

  it("primeira resposta é só a da primeira vez do dia", () => {
    const conversas = [
      {
        mensagens: [
          cli("2026-11-18T10:00:00"),
          emp("2026-11-18T10:04:00"),
          cli("2026-11-18T11:00:00"),
          emp("2026-11-18T11:30:00"),
        ],
      },
    ];
    const linha = metricasDoDia(conversas, "2026-11-18", d("2026-11-18T12:00:00"), r);
    expect(linha.primeirasRespostasSeg).toEqual([240]);
    expect(linha.respostasSeg).toEqual([240, 1800]);
    expect(linha.respostasNoSla).toBe(1);
    expect(linha.conversasComCliente).toBe(1);
  });

  it("vez aberta com 20 min úteis conta em semResposta com SLA 15", () => {
    const conversas = [
      { mensagens: [cli("2026-11-18T10:00:00")] },
      { mensagens: [cli("2026-11-18T10:10:00")] }, // aberta há 10 min: ainda dentro do SLA
    ];
    const linha = metricasDoDia(conversas, "2026-11-18", d("2026-11-18T10:20:00"), r);
    expect(linha.semResposta).toBe(1);
    expect(linha.respostasSeg).toEqual([]);
    expect(linha.conversasComCliente).toBe(2);
  });

  it("resposta de 15 min exatos conta dentro do SLA", () => {
    const conversas = [{ mensagens: [cli("2026-11-18T10:00:00"), emp("2026-11-18T10:15:00")] }];
    const linha = metricasDoDia(conversas, "2026-11-18", d("2026-11-18T12:00:00"), r);
    expect(linha.respostasSeg).toEqual([900]);
    expect(linha.respostasNoSla).toBe(1);
    expect(linha.semResposta).toBe(0);
  });

  it("follow-up conta no dia em que venceu", () => {
    const conversas = [
      { mensagens: [emp("2026-11-16T10:00:00"), emp("2026-11-18T10:00:00")] }, // feito, vence 17
      { mensagens: [emp("2026-11-16T11:00:00")] }, // perdido (agora = 20 12h), vence 17
    ];
    const agora = d("2026-11-20T12:00:00");
    const terca = metricasDoDia(conversas, "2026-11-17", agora, r);
    expect(terca.followupsFeitos).toBe(1);
    expect(terca.followupsPerdidos).toBe(1);
    expect(terca.conversasComCliente).toBe(0);
    const segunda = metricasDoDia(conversas, "2026-11-16", agora, r);
    expect(segunda.followupsFeitos).toBe(0);
    expect(segunda.followupsPerdidos).toBe(0);
  });
});

describe("metricasDoDia: follow-up perto da meia-noite", () => {
  it("E às 22h de São Paulo: o follow-up conta no dia de São Paulo do devidoEm, não no dia UTC", () => {
    // segunda 22h SP = terça 01h UTC; devidoEm = terça 22h SP = quarta 01h UTC
    const conversas = [{ mensagens: [emp("2026-11-16T22:00:00"), emp("2026-11-18T10:00:00")] }];
    const agora = d("2026-11-20T12:00:00");
    expect(metricasDoDia(conversas, "2026-11-17", agora, r).followupsFeitos).toBe(1);
    expect(metricasDoDia(conversas, "2026-11-18", agora, r).followupsFeitos).toBe(0);
  });
});

describe("metricasDosDias", () => {
  // Gerador determinístico: várias conversas com mensagens espalhadas por ~3 semanas, em qualquer hora.
  function conversasAleatorias(semente: number) {
    let x = semente;
    const rand = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const base = d("2026-10-25T00:00:00").getTime();
    return Array.from({ length: 25 }, () => {
      let t = base + rand() * 5 * 24 * H;
      const mensagens: MensagemTempo[] = [];
      const total = 1 + Math.floor(rand() * 30);
      for (let i = 0; i < total; i++) {
        // Intervalos de minutos a alguns dias, para cair em SLA, follow-up feito, cancelado e perdido.
        const salto = rand() < 0.2 ? rand() * 4 * 24 * H : rand() < 0.5 ? rand() * 30 * 60_000 : rand() * 10 * H;
        t += salto;
        mensagens.push({ deMim: rand() < 0.5, enviadaEm: new Date(t) });
      }
      return { mensagens };
    });
  }

  it("dá o mesmo que metricasDoDia dia a dia", () => {
    const agora = d("2026-11-18T12:00:00");
    const dias = Array.from({ length: 35 }, (_, i) => somarDias("2026-11-18", i - 34));
    for (const semente of [1, 7, 42, 2026]) {
      const conversas = conversasAleatorias(semente);
      const porDia = metricasDosDias(conversas, dias, agora, r);
      expect([...porDia.keys()]).toEqual(dias);
      for (const dia of dias) expect(porDia.get(dia)).toEqual(metricasDoDia(conversas, dia, agora, r));
    }
  });

  it("dia sem conversa dá linha zerada", () => {
    const porDia = metricasDosDias([], ["2026-11-18"], d("2026-11-18T12:00:00"), r);
    expect(porDia.get("2026-11-18")).toEqual(metricasDoDia([], "2026-11-18", d("2026-11-18T12:00:00"), r));
  });
});

describe("mediana e percentual", () => {
  it("mediana", () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(3);
  });
  it("percentual", () => {
    expect(percentual(0, 0)).toBeNull();
    expect(percentual(9, 10)).toBe(90);
    expect(percentual(57, 200)).toBe(29);
  });
});
