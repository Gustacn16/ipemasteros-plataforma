// Regras puras dos limites de uso da IA. "Hoje" e "mês" seguem o calendário de São Paulo.
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

// São Paulo fica em UTC-3 o ano todo (sem horário de verão desde 2019): meia-noite local = 03:00 UTC.
const HORA_UTC_DA_MEIA_NOITE = "T03:00:00.000Z";

/** Instante (UTC) em que o dia de São Paulo de `agora` começou. */
export function inicioDoDiaSaoPaulo(agora: Date): Date {
  return new Date(`${diaEmSaoPaulo(agora)}${HORA_UTC_DA_MEIA_NOITE}`);
}

/** Instante (UTC) em que o mês de São Paulo de `agora` começou. */
export function inicioDoMesSaoPaulo(agora: Date): Date {
  return new Date(`${diaEmSaoPaulo(agora).slice(0, 7)}-01${HORA_UTC_DA_MEIA_NOITE}`);
}

export type EntradaLimites = {
  perguntasHoje: number;
  perguntasPorDia: number;
  gastoMesMicroUsd: number;
  limiteMensalMicroUsd: number;
};

export type SituacaoLimites = { ok: true; restantesHoje: number } | { ok: false; motivo: "dia" | "mes" };

/** O limite do mês é checado antes do limite do dia. */
export function avaliarLimites(e: EntradaLimites): SituacaoLimites {
  if (e.gastoMesMicroUsd >= e.limiteMensalMicroUsd) return { ok: false, motivo: "mes" };
  if (e.perguntasHoje >= e.perguntasPorDia) return { ok: false, motivo: "dia" };
  return { ok: true, restantesHoje: e.perguntasPorDia - e.perguntasHoje };
}
