// Tipos de avaliação, critérios e notas calculadas pelo sistema. Regra pura: sem banco.
import type { TimeNumeroWhatsapp } from "@/generated/prisma/enums";
import type { RegrasAtendimento } from "../esquemas/regras-atendimento";
import { eventosDaConversa, type MensagemTempo } from "./atendimento";

export type TipoAvaliacao = "vendas" | "cs";

export function tipoDoTime(time: TimeNumeroWhatsapp): TipoAvaliacao | null {
  if (time === "cs") return "cs";
  if (time === "paciente_modelo" || time === "comercial") return "vendas";
  return null;
}

export const CRITERIOS: Record<TipoAvaliacao, readonly { chave: string; rotulo: string }[]> = {
  vendas: [
    { chave: "qualificacao", rotulo: "Qualificação" },
    { chave: "quebra_objecao", rotulo: "Quebra de objeção" },
    { chave: "followup", rotulo: "Follow-up" },
    { chave: "clareza_cordialidade", rotulo: "Clareza e cordialidade" },
    { chave: "conducao_fechamento", rotulo: "Conduziu para o fechamento" },
  ],
  cs: [
    { chave: "cordialidade", rotulo: "Cordialidade" },
    { chave: "clareza", rotulo: "Clareza" },
    { chave: "resolveu_duvida", rotulo: "Resolveu a dúvida" },
    { chave: "conduziu_proximo_passo", rotulo: "Conduziu o próximo passo" },
  ],
};

export const CRITERIO_TEMPO = { chave: "tempo_resposta", rotulo: "Tempo de resposta (sistema)" } as const;

/**
 * Nota 0-10 do tempo de resposta: das vezes do cliente que começaram ontem, a fatia dentro do SLA.
 * `todas` em ordem crescente. Uma vez ainda aberta no fim de ontem conta fora do SLA.
 */
export function notaDeTempo(
  todas: MensagemTempo[],
  ontem: { inicio: Date; fim: Date },
  regras: RegrasAtendimento,
): number | null {
  const { vezes } = eventosDaConversa(todas, ontem.fim, regras);
  const deOntem = vezes.filter((v) => v.inicio >= ontem.inicio && v.inicio <= ontem.fim);
  if (deOntem.length === 0) return null;
  const noSla = deOntem.filter((v) => v.respondidaEm !== null && v.respondidaEm <= ontem.fim && v.segundos <= regras.slaMinutos * 60).length;
  return Math.round((10 * noSla) / deOntem.length);
}

/** Média das notas (0-10) não nulas, em décimos (0-100). */
export function notaGeralDecimos(notas: (number | null)[]): number | null {
  const validas = notas.filter((n): n is number => n !== null);
  if (validas.length === 0) return null;
  return Math.round((validas.reduce((a, b) => a + b, 0) / validas.length) * 10);
}

export function formatarNota(decimos: number | null): string {
  if (decimos === null) return "—";
  return (decimos / 10).toFixed(1).replace(".", ",");
}
