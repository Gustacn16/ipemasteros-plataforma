import type { SituacaoAvisoGrupo, SituacaoEnvioAviso } from "@/generated/prisma/client";

export const ROTULO_SITUACAO_AVISO: Record<SituacaoAvisoGrupo, string> = {
  rascunho: "Rascunho",
  aprovado: "Aprovado",
  enviando: "Enviando",
  concluido: "Enviado",
  cancelado: "Cancelado",
  falhou: "Não enviado",
};

/** Só rascunho e aprovado podem ser editados; salvar um aprovado o devolve a rascunho. */
export const avisoEditavel = (s: SituacaoAvisoGrupo) => s === "rascunho" || s === "aprovado";

/** Instante -> valor de `datetime-local` (`YYYY-MM-DDTHH:MM`) no horário de São Paulo (UTC-3 fixo). */
export function paraCampoDataHora(d: Date): string {
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16);
}

/** Texto de um destino do aviso depois (ou durante) o envio. */
export function rotuloEnvio(situacao: SituacaoEnvioAviso, erro: string | null): string {
  switch (situacao) {
    case "enviado":
      return "✓ enviado";
    case "falhou":
      return `✗ falhou${erro ? ` (${erro})` : ""}`;
    case "sem_numero":
      return "sem número para enviar";
    case "cancelado":
      return "cancelado";
    default:
      return "aguardando";
  }
}
