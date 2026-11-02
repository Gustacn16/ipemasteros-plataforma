// Datas do módulo Conteúdo. Datas de gravação e publicação são dias (@db.Date).
import { diaDaDataEntrega, diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import type { Etapa } from "./etapas";

export function conteudoAtrasado(dataPublicacao: Date | null, etapa: Etapa, agora: Date): boolean {
  if (!dataPublicacao || etapa === "publicado" || etapa === "cancelado") return false;
  return diaDaDataEntrega(dataPublicacao) < diaEmSaoPaulo(agora);
}

export type DiaGrade = { dia: string; doMes: boolean };

/** Semanas (domingo a sábado) que cobrem o mês "AAAA-MM". */
export function gradeDoMes(mes: string): DiaGrade[][] {
  const primeiro = `${mes}-01`;
  const recuo = new Date(`${primeiro}T00:00:00Z`).getUTCDay(); // 0 = domingo
  let dia = somarDias(primeiro, -recuo);
  const semanas: DiaGrade[][] = [];
  do {
    const semana: DiaGrade[] = [];
    for (let i = 0; i < 7; i++) {
      semana.push({ dia, doMes: dia.startsWith(mes) });
      dia = somarDias(dia, 1);
    }
    semanas.push(semana);
  } while (dia.startsWith(mes));
  return semanas;
}

export function proximoMes(mes: string): string {
  return somarDias(`${mes}-28`, 7).slice(0, 7);
}

export function mesAnterior(mes: string): string {
  return somarDias(`${mes}-01`, -1).slice(0, 7);
}

/** Mês atual ("AAAA-MM") em São Paulo. */
export function mesAtual(agora = new Date()): string {
  return diaEmSaoPaulo(agora).slice(0, 7);
}

type Metricas = {
  alcance: number | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvamentos: number | null;
};

/** (curtidas + comentários + compartilhamentos + salvamentos) ÷ alcance, em %, 1 casa. Null sem alcance. */
export function taxaEngajamento(m: Metricas): number | null {
  if (!m.alcance) return null;
  const interacoes = (m.curtidas ?? 0) + (m.comentarios ?? 0) + (m.compartilhamentos ?? 0) + (m.salvamentos ?? 0);
  return Math.round((interacoes / m.alcance) * 1000) / 10;
}
