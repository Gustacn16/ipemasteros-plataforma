/**
 * Cópia local dos tipos do contrato com o IPEMaster OS
 * (origem: src/modulos/whatsapp/esquemas/motor.ts). O motor não importa nada de src/.
 */

/** Mesmos valores do enum TipoMensagemWhatsapp. */
export type TipoMensagem = "texto" | "imagem" | "audio" | "video" | "documento" | "figurinha" | "outro";

/** Conversa que o motor conhece (jid termina em @g.us, @s.whatsapp.net ou @lid). */
export type ConversaMotor = { jid: string; tipo: "grupo" | "individual"; nome?: string };

/** Mensagem capturada (só texto/legenda; mídia nunca é baixada). texto ≤ 4000, enviadaEm em ISO 8601. */
export type MensagemMotor = {
  idExterno: string;
  jid: string;
  autorJid?: string;
  autorTelefone?: string;
  autorNome?: string;
  deMim: boolean;
  tipo: TipoMensagem;
  texto?: string;
  respondeA?: string;
  enviadaEm: string;
};

export type EventoConversas = { tipo: "conversas"; numeroId: string; conversas: ConversaMotor[] };
export type EventoMensagens = {
  tipo: "mensagens";
  numeroId: string;
  origem: "historico" | "ao_vivo";
  mensagens: MensagemMotor[];
};

/** Eventos que o motor manda para o sistema (QR, conexão, sinal de vida, conversas e mensagens). */
export type EventoMotor =
  | { tipo: "qr"; numeroId: string; qr: string }
  | { tipo: "conectado"; numeroId: string; telefone: string }
  | {
      tipo: "desconectado";
      numeroId: string;
      motivo: "removido_no_celular" | "pedido" | "erro";
      detalhe?: string;
    }
  | { tipo: "sinal"; conectados: string[] }
  | EventoConversas
  | EventoMensagens;

/** Comando que o sistema deixa na fila para o motor executar. */
export type ComandoMotor = { id: string; numeroId: string; tipo: "conectar" | "desconectar" };

export type ResultadoComando = { situacao: "concluido" | "falhou"; erro?: string };

/** Telefone (só dígitos) a partir do JID do WhatsApp. Cópia de src/modulos/whatsapp/regras/conexao.ts. */
export function telefoneDoJid(jid: string): string | null {
  const m = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/.exec(jid);
  return m ? m[1] : null;
}
