import type { FaixaHorario } from "../esquemas/regras-atendimento";

const DIA_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = 3 * 60 * 60 * 1000; // São Paulo fixo em UTC-3

/** Segundos de [inicio, fim) que caem dentro das faixas do horário, em São Paulo (UTC-3). */
export function segundosUteis(inicio: Date, fim: Date, horario: (FaixaHorario | null)[]): number {
  const ini = inicio.getTime();
  const fi = fim.getTime();
  if (!(fi > ini)) return 0;

  // "Relógio de parede" de São Paulo: o dia é o piso da divisão por 24 h.
  let dia = Math.floor((ini - OFFSET_MS) / DIA_MS);
  const ultimoDia = Math.floor((fi - OFFSET_MS) / DIA_MS);
  let totalMs = 0;
  for (; dia <= ultimoDia; dia++) {
    const faixa = horario[(((dia + 4) % 7) + 7) % 7]; // 1970-01-01 foi quinta (4)
    if (!faixa) continue;
    const meiaNoite = dia * DIA_MS + OFFSET_MS;
    const de = Math.max(ini, meiaNoite + faixa.inicioMin * 60_000);
    const ate = Math.min(fi, meiaNoite + faixa.fimMin * 60_000);
    if (ate > de) totalMs += ate - de;
  }
  return Math.round(totalMs / 1000);
}

/** "—", "menos de 1 min", "9 min", "1 h 05 min". */
export function formatarDuracao(segundos: number | null): string {
  if (segundos === null || !Number.isFinite(segundos)) return "—";
  if (segundos < 60) return "menos de 1 min";
  const min = Math.floor(segundos / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export const DIAS_DA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

/** 480 → "08:00". */
export function minutosParaHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** "08:00" → 480; "24:00" vale como fim do dia; formato ou hora inválida → null. */
export function horaParaMinutos(hora: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && total <= 1440 ? total : null;
}

/** Uma linha por dia, de domingo a sábado: "Segunda: 08:00 às 18:00" ou "Domingo: fechado". */
export function textoDoHorario(horario: (FaixaHorario | null)[]): string[] {
  return DIAS_DA_SEMANA.map((nome, i) => {
    const f = horario[i];
    return f ? `${nome}: ${minutosParaHora(f.inicioMin)} às ${minutosParaHora(f.fimMin)}` : `${nome}: fechado`;
  });
}
