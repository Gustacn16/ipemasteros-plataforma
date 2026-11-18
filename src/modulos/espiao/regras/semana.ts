import { inicioDoDiaSaoPaulo } from "@/lib/ia/limites";

const DIA_MS = 86_400_000;

/** Instante (UTC) da segunda-feira 00:00 de São Paulo da semana de `agora` (semana = segunda a domingo). */
export function inicioDaSemanaSaoPaulo(agora: Date): Date {
  const inicioDoDia = inicioDoDiaSaoPaulo(agora);
  // inicioDoDia é 03:00 UTC do dia local: ao meio-dia UTC desse dia, o dia da semana é o local.
  const diaDaSemana = new Date(inicioDoDia.getTime() + 9 * 3_600_000).getUTCDay();
  const desdeSegunda = (diaDaSemana + 6) % 7;
  return new Date(inicioDoDia.getTime() - desdeSegunda * DIA_MS);
}
