import { formatarDuracao } from "./horario";

/** Depois de 7 dias sem envio da CS, a venda passa de "aguardando" para "sem contato". */
export const DIAS_SEM_CONTATO = 7;

export type SituacaoVendaCs = "contatada" | "aguardando" | "sem_contato" | "sem_whatsapp";

/**
 * Situação de uma venda para a CS. `enviosCs` são as mensagens `deMim` dos números `cs` para o
 * contato, em ordem crescente. Vale o primeiro envio a partir de `criadoEm`; segundos corridos.
 */
export function situacaoVendaCs(
  criadoEm: Date,
  temWhatsapp: boolean,
  enviosCs: Date[],
  agora: Date,
): { situacao: SituacaoVendaCs; primeiroContatoEm: Date | null; segundos: number | null } {
  if (!temWhatsapp) return { situacao: "sem_whatsapp", primeiroContatoEm: null, segundos: null };
  const primeiro = enviosCs.find((e) => e.getTime() >= criadoEm.getTime());
  if (primeiro) {
    return { situacao: "contatada", primeiroContatoEm: primeiro, segundos: Math.round((primeiro.getTime() - criadoEm.getTime()) / 1000) };
  }
  const passados = agora.getTime() - criadoEm.getTime();
  if (passados <= DIAS_SEM_CONTATO * 86_400_000) {
    return { situacao: "aguardando", primeiroContatoEm: null, segundos: Math.max(0, Math.round(passados / 1000)) };
  }
  return { situacao: "sem_contato", primeiroContatoEm: null, segundos: null };
}

/** Texto do tempo na tabela da CS, conforme a situação da venda. */
export function rotuloSituacaoCs(situacao: SituacaoVendaCs, segundos: number | null): string {
  if (situacao === "contatada") return formatarDuracao(segundos);
  if (situacao === "aguardando") return `aguardando · ${formatarDuracao(segundos)}`;
  if (situacao === "sem_contato") return `sem contato em ${DIAS_SEM_CONTATO} dias`;
  return "sem WhatsApp na venda";
}
