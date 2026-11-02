// Datas de tarefas. A entrega é um dia (sem hora); "hoje" e "atrasada" são
// decididos pelo calendário de São Paulo.
import { FUSO_PADRAO } from "@/lib/datas";

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_PADRAO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia ("AAAA-MM-DD") de um instante no fuso de São Paulo. */
export function diaEmSaoPaulo(data: Date): string {
  return formatoDia.format(data);
}

/** Dia de uma coluna @db.Date, que o Prisma entrega como meia-noite UTC. */
export function diaDaDataEntrega(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Soma dias a um "AAAA-MM-DD". */
export function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export const GRUPOS_MINHAS = ["atrasadas", "hoje", "proximos7", "depois", "sem_data"] as const;
export type GrupoMinhas = (typeof GRUPOS_MINHAS)[number];

export const ROTULO_GRUPO_MINHAS: Record<GrupoMinhas, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  proximos7: "Próximos 7 dias",
  depois: "Depois",
  sem_data: "Sem data",
};

export function grupoDaEntrega(dataEntrega: Date | null, agora: Date): GrupoMinhas {
  if (!dataEntrega) return "sem_data";
  const hoje = diaEmSaoPaulo(agora);
  const entrega = diaDaDataEntrega(dataEntrega);
  if (entrega < hoje) return "atrasadas";
  if (entrega === hoje) return "hoje";
  if (entrega <= somarDias(hoje, 7)) return "proximos7";
  return "depois";
}

/** A tarefa está atrasada se não foi concluída e a entrega é anterior a hoje. */
export function estaAtrasada(dataEntrega: Date | null, concluidaEm: Date | null, agora: Date): boolean {
  return !concluidaEm && grupoDaEntrega(dataEntrega, agora) === "atrasadas";
}

/** Início não pode ser depois da entrega (regra 10). */
export function datasValidas(inicio: Date | null, entrega: Date | null): boolean {
  if (!inicio || !entrega) return true;
  return diaDaDataEntrega(inicio) <= diaDaDataEntrega(entrega);
}
