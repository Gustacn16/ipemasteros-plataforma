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

/** Lê `?dia=AAAA-MM-DD`; vazio ou inválido (formato ou data que não existe) vira ontem. Devolve a data de São Paulo e a meia-noite UTC dela. */
export function diaDaConsulta(valor: string | undefined, agora: Date): { texto: string; dia: Date } {
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const dia = new Date(`${valor}T00:00:00.000Z`);
    if (!Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === valor) return { texto: valor, dia };
  }
  const { dia } = janelaDeOntem(agora);
  return { texto: dia.toISOString().slice(0, 10), dia };
}
