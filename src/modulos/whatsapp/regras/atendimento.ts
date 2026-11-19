// Vezes do cliente, follow-ups e métricas de um dia. Regra pura: sem banco.
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import type { RegrasAtendimento } from "../esquemas/regras-atendimento";
import { segundosUteis } from "./horario";

const HORA_MS = 60 * 60 * 1000;

export type MensagemTempo = { deMim: boolean; enviadaEm: Date };

/** Uma vez do cliente: da primeira mensagem dele até a próxima da empresa. */
export type Vez = { inicio: Date; respondidaEm: Date | null; segundos: number };

export type Followup = { devidoEm: Date; resultado: "feito" | "perdido" | "pendente" | "cancelado" };

export type LinhaDia = {
  conversasComCliente: number;
  primeirasRespostasSeg: number[];
  respostasSeg: number[];
  respostasNoSla: number;
  semResposta: number;
  followupsFeitos: number;
  followupsPerdidos: number;
};

/** As mensagens chegam em ordem crescente de `enviadaEm`. */
export function eventosDaConversa(
  mensagens: MensagemTempo[],
  agora: Date,
  regras: RegrasAtendimento,
): { vezes: Vez[]; followups: Followup[] } {
  const vezes: Vez[] = [];
  const followups: Followup[] = [];
  let aberta: Date | null = null;

  for (let i = 0; i < mensagens.length; i++) {
    const m = mensagens[i];
    if (!m.deMim) {
      if (!aberta) aberta = m.enviadaEm;
      continue;
    }
    if (aberta) {
      vezes.push({ inicio: aberta, respondidaEm: m.enviadaEm, segundos: segundosUteis(aberta, m.enviadaEm, regras.horario) });
      aberta = null;
    }
    const f = followupDe(m.enviadaEm, mensagens[i + 1], agora, regras);
    if (f) followups.push(f);
  }
  if (aberta) vezes.push({ inicio: aberta, respondidaEm: null, segundos: segundosUteis(aberta, agora, regras.horario) });

  return { vezes, followups };
}

/** Follow-up de uma mensagem da empresa, decidido só pela mensagem seguinte (horas e dias de relógio). */
function followupDe(e: Date, proxima: MensagemTempo | undefined, agora: Date, regras: RegrasAtendimento): Followup | null {
  const devido = e.getTime() + regras.followupHoras * HORA_MS;
  const prazo = e.getTime() + regras.followupDias * 24 * HORA_MS;
  if (proxima && proxima.enviadaEm.getTime() <= devido) return null;
  const devidoEm = new Date(devido);
  if (proxima && proxima.enviadaEm.getTime() <= prazo) {
    return { devidoEm, resultado: proxima.deMim ? "feito" : "cancelado" };
  }
  if (!proxima && agora.getTime() < prazo) return { devidoEm, resultado: "pendente" };
  return { devidoEm, resultado: "perdido" };
}

/** Métricas de um dia ("AAAA-MM-DD" de São Paulo). Vez conta no dia em que começou; follow-up, no dia em que venceu. */
export function metricasDoDia(
  conversas: { mensagens: MensagemTempo[] }[],
  dia: string,
  agora: Date,
  regras: RegrasAtendimento,
): LinhaDia {
  const sla = regras.slaMinutos * 60;
  const linha: LinhaDia = {
    conversasComCliente: 0,
    primeirasRespostasSeg: [],
    respostasSeg: [],
    respostasNoSla: 0,
    semResposta: 0,
    followupsFeitos: 0,
    followupsPerdidos: 0,
  };

  for (const { mensagens } of conversas) {
    if (mensagens.some((m) => !m.deMim && diaEmSaoPaulo(m.enviadaEm) === dia)) linha.conversasComCliente++;

    const { vezes, followups } = eventosDaConversa(mensagens, agora, regras);
    const doDia = vezes.filter((v) => diaEmSaoPaulo(v.inicio) === dia);
    if (doDia[0]?.respondidaEm) linha.primeirasRespostasSeg.push(doDia[0].segundos);
    for (const v of doDia) {
      if (v.respondidaEm) {
        linha.respostasSeg.push(v.segundos);
        if (v.segundos <= sla) linha.respostasNoSla++;
      } else if (v.segundos > sla) {
        linha.semResposta++;
      }
    }

    for (const f of followups) {
      if (diaEmSaoPaulo(f.devidoEm) !== dia) continue;
      if (f.resultado === "feito") linha.followupsFeitos++;
      else if (f.resultado === "perdido") linha.followupsPerdidos++;
    }
  }
  return linha;
}

/** Mediana; com tamanho par, a média arredondada dos dois do meio. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : Math.round((v[meio - 1] + v[meio]) / 2);
}

/** Inteiro de 0 a 100; null se não há total. */
export function percentual(parte: number, total: number): number | null {
  if (total === 0) return null;
  return Math.min(100, Math.max(0, Math.round((parte * 100) / total)));
}
