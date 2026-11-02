import { somarDias } from "@/modulos/tarefas/regras/prazo";

/** Deslocamento fixo de São Paulo (UTC−3). */
const FUSO_MS = -3 * 60 * 60 * 1000;

export type EventoPessoalBruto = {
  agendaId: string;
  uid: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
  local: string | null;
};

/** Mesmo formato de `ItemAgenda` (tipo "pessoal", sem link), só com textos: pode ir para componente client. */
export type ItemPessoal = {
  id: string;
  tipo: "pessoal";
  titulo: string;
  inicio: string;
  fim: string;
  horaInicio: string | null;
  horaFim: string | null;
  cor: string;
  href: null;
  detalhe?: string;
};

function emSaoPaulo(instante: Date): { dia: string; hora: string } {
  const iso = new Date(instante.getTime() + FUSO_MS).toISOString();
  return { dia: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/**
 * Converte os eventos lidos das agendas pessoais em itens da tela, com dia e hora de São Paulo.
 * No iCal o fim de um evento de dia inteiro é exclusivo: o último dia é `fim − 1 dia`.
 * Evento com hora que termina à meia-noite do dia seguinte fica no mesmo dia, até "24:00".
 */
export function itensPessoais(eventos: EventoPessoalBruto[], agendas: { id: string; nome: string; cor: string }[]): ItemPessoal[] {
  const porId = new Map(agendas.map((a) => [a.id, a]));
  return eventos.flatMap((e): ItemPessoal[] => {
    const agenda = porId.get(e.agendaId);
    if (!agenda) return [];
    const de = emSaoPaulo(e.inicio);
    const ate = emSaoPaulo(e.fim);
    const base = {
      id: `${e.agendaId}:${e.uid}:${e.inicio.getTime()}`,
      tipo: "pessoal" as const,
      titulo: e.titulo || "(sem título)",
      cor: agenda.cor,
      href: null,
      detalhe: [agenda.nome, e.local].filter(Boolean).join(" · "),
    };
    if (e.diaInteiro) {
      const ultimo = somarDias(ate.dia, -1);
      return [{ ...base, inicio: de.dia, fim: ultimo < de.dia ? de.dia : ultimo, horaInicio: null, horaFim: null }];
    }
    if (e.fim.getTime() <= e.inicio.getTime()) {
      return [{ ...base, inicio: de.dia, fim: de.dia, horaInicio: de.hora, horaFim: null }];
    }
    if (ate.hora === "00:00" && somarDias(ate.dia, -1) === de.dia) {
      return [{ ...base, inicio: de.dia, fim: de.dia, horaInicio: de.hora, horaFim: "24:00" }];
    }
    return [{ ...base, inicio: de.dia, fim: ate.dia, horaInicio: de.hora, horaFim: ate.hora }];
  });
}

/** "Lida às HH:MM" (hoje) ou "Lida em DD/MM às HH:MM", no horário de São Paulo. */
export function rotuloLeitura(ultimoSucessoEm: Date | null, agora = new Date()): string | null {
  if (!ultimoSucessoEm) return null;
  const quando = emSaoPaulo(ultimoSucessoEm);
  if (quando.dia === emSaoPaulo(agora).dia) return `Lida às ${quando.hora}`;
  return `Lida em ${quando.dia.slice(8)}/${quando.dia.slice(5, 7)} às ${quando.hora}`;
}
