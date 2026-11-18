// Janela de "ontem" no calendário de São Paulo (UTC-3 fixo).
import { inicioDoDiaSaoPaulo } from "@/lib/ia/limites";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

const MS_DIA = 86_400_000;

/** `dia` é a meia-noite UTC da data de São Paulo de ontem (para gravar em @db.Date). */
export function janelaDeOntem(agora: Date): { dia: Date; inicio: Date; fim: Date } {
  const fim = inicioDoDiaSaoPaulo(agora);
  const inicio = new Date(fim.getTime() - MS_DIA);
  const dia = new Date(`${diaEmSaoPaulo(inicio)}T00:00:00.000Z`);
  return { dia, inicio, fim };
}
