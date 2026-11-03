// Datas de tarefas. A entrega é um dia (sem hora); "hoje" e "atrasada" são
// decididos pelo calendário de São Paulo.
import type { Tom } from "@/componentes/regras-visuais";
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

export type TomEntrega = "concluida" | "atrasada" | "hoje" | "amanha" | "proxima" | "futura";

/** Situação da entrega para o cartão: tom de cor e quantos dias faltam (negativo = atraso). */
export function situacaoEntrega(dataEntrega: Date, concluidaEm: Date | null, agora: Date): { tom: TomEntrega; dias: number } {
  const hoje = Date.parse(`${diaEmSaoPaulo(agora)}T00:00:00Z`);
  const dias = Math.round((Date.parse(`${diaDaDataEntrega(dataEntrega)}T00:00:00Z`) - hoje) / 86_400_000);
  if (concluidaEm) return { tom: "concluida", dias };
  if (dias < 0) return { tom: "atrasada", dias };
  if (dias === 0) return { tom: "hoje", dias };
  if (dias === 1) return { tom: "amanha", dias };
  return { tom: dias <= 7 ? "proxima" : "futura", dias };
}

/** Texto e tom do chip de prazo (spec, seção 5). `dataEntrega` só é usada na data curta. */
export function rotuloChipPrazo(
  s: { tom: TomEntrega; dias: number },
  dataEntrega: Date,
): { texto: string; tom: Tom } {
  switch (s.tom) {
    case "concluida":
      return { texto: "Concluída", tom: "sucesso" };
    case "atrasada": {
      const n = Math.abs(s.dias);
      return { texto: `Atrasada ${n} ${n === 1 ? "dia" : "dias"}`, tom: "perigo" };
    }
    case "hoje":
      return { texto: "Vence hoje", tom: "atencao" };
    case "amanha":
      return { texto: "Vence amanhã", tom: "atencao" };
    case "proxima":
      return { texto: `Em ${s.dias} dias`, tom: "informacao" };
    case "futura": {
      const iso = diaDaDataEntrega(dataEntrega);
      return { texto: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, tom: "neutro" };
    }
  }
}
