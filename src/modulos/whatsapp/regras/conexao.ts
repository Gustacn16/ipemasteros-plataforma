import type { SituacaoNumeroWhatsapp } from "@/generated/prisma/client";

/** O QR muda a cada ~20 s; depois de 60 s o que está na tela já não serve. */
export const QR_VALIDO_MS = 60_000;
/** Sem sinal do motor por mais de 5 min, a tela avisa que ele não responde. */
export const MOTOR_SEM_SINAL_MS = 5 * 60_000;

export type EstadoTela =
  | "conectado"
  | "aguardando_qr"
  | "qr_expirado"
  | "desconectado"
  | "removido_no_celular"
  | "erro"
  | "motor_sem_resposta";

export const ROTULO_ESTADO: Record<EstadoTela, string> = {
  conectado: "Conectado",
  aguardando_qr: "Aguardando leitura do QR",
  qr_expirado: "O QR expirou. Clique em Conectar de novo.",
  desconectado: "Desconectado",
  removido_no_celular: "Removido no celular. Leia o QR de novo.",
  erro: "Erro na conexão",
  motor_sem_resposta: "Motor sem resposta",
};

/** Situação mostrada na tela, combinando o que está no banco com o sinal do motor e a idade do QR. */
export function estadoNaTela(
  n: { situacao: SituacaoNumeroWhatsapp; qrEm: Date | null; ultimoSinalEm: Date | null; erro: string | null },
  agora: Date,
): EstadoTela {
  if (n.situacao === "desconectado") {
    return n.erro === "removido_no_celular" ? "removido_no_celular" : "desconectado";
  }
  if (!n.ultimoSinalEm || agora.getTime() - n.ultimoSinalEm.getTime() > MOTOR_SEM_SINAL_MS) {
    return "motor_sem_resposta";
  }
  if (n.situacao === "aguardando_qr" && n.qrEm && agora.getTime() - n.qrEm.getTime() > QR_VALIDO_MS) {
    return "qr_expirado";
  }
  return n.situacao;
}

/** "5562999999999:12@s.whatsapp.net" → "5562999999999"; JID que não é telefone (ex.: @lid) → null. */
export function telefoneDoJid(jid: string): string | null {
  const m = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/.exec(jid);
  return m ? m[1] : null;
}
