/**
 * Cópia local dos tipos do contrato com o IPEMaster OS
 * (origem: src/modulos/whatsapp/esquemas/motor.ts). O motor não importa nada de src/.
 */

/** Eventos que o motor manda para o sistema (QR novo, conectou, caiu, sinal de vida). */
export type EventoMotor =
  | { tipo: "qr"; numeroId: string; qr: string }
  | { tipo: "conectado"; numeroId: string; telefone: string }
  | {
      tipo: "desconectado";
      numeroId: string;
      motivo: "removido_no_celular" | "pedido" | "erro";
      detalhe?: string;
    }
  | { tipo: "sinal"; conectados: string[] };

/** Comando que o sistema deixa na fila para o motor executar. */
export type ComandoMotor = { id: string; numeroId: string; tipo: "conectar" | "desconectar" };

export type ResultadoComando = { situacao: "concluido" | "falhou"; erro?: string };

/** Telefone (só dígitos) a partir do JID do WhatsApp. Cópia de src/modulos/whatsapp/regras/conexao.ts. */
export function telefoneDoJid(jid: string): string | null {
  const m = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/.exec(jid);
  return m ? m[1] : null;
}
