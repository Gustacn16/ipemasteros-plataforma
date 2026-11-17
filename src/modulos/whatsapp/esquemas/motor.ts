import { z } from "zod";

/** JID aceito: grupo, individual ou LID (status@broadcast e canais ficam de fora). */
const jidValido = z
  .string()
  .max(60)
  .regex(/^[^@\s]+@(g\.us|s\.whatsapp\.net|lid)$/);

/** Mesmos valores do enum TipoMensagemWhatsapp do Prisma. */
const esquemaTipoMensagem = z.enum(["texto", "imagem", "audio", "video", "documento", "figurinha", "outro"]);

const esquemaConversaMotor = z.object({
  jid: jidValido,
  tipo: z.enum(["grupo", "individual"]),
  nome: z.string().max(120).optional(),
});

const esquemaMensagemMotor = z.object({
  idExterno: z.string().min(1).max(100),
  jid: jidValido,
  autorJid: jidValido.optional(),
  autorTelefone: z.string().regex(/^\d{10,15}$/).optional(),
  autorNome: z.string().max(100).optional(),
  deMim: z.boolean(),
  tipo: esquemaTipoMensagem,
  texto: z.string().max(4000).optional(),
  respondeA: z.string().max(100).optional(),
  enviadaEm: z.iso.datetime({ offset: true }),
});

/** Eventos que o motor manda para o sistema (QR, conexão, sinal de vida, conversas e mensagens). */
export const esquemaEventoMotor = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("qr"), numeroId: z.string().min(1), qr: z.string().min(1).max(1000) }),
  z.object({
    tipo: z.literal("conectado"),
    numeroId: z.string().min(1),
    telefone: z.string().regex(/^\d{10,15}$/),
  }),
  z.object({
    tipo: z.literal("desconectado"),
    numeroId: z.string().min(1),
    motivo: z.enum(["removido_no_celular", "pedido", "erro"]),
    detalhe: z.string().max(255).optional(),
  }),
  z.object({ tipo: z.literal("sinal"), conectados: z.array(z.string()) }),
  z.object({ tipo: z.literal("conversas"), numeroId: z.string().min(1), conversas: z.array(esquemaConversaMotor).max(500) }),
  z.object({
    tipo: z.literal("mensagens"),
    numeroId: z.string().min(1),
    origem: z.enum(["historico", "ao_vivo"]),
    mensagens: z.array(esquemaMensagemMotor).max(100),
  }),
]);

export const esquemaLoteEventos = z.object({ eventos: z.array(esquemaEventoMotor).max(500) });

export const esquemaResultadoComando = z.object({
  situacao: z.enum(["concluido", "falhou"]),
  erro: z.string().max(255).optional(),
});

export type EventoMotor = z.infer<typeof esquemaEventoMotor>;
export type TipoMensagem = z.infer<typeof esquemaTipoMensagem>;
export type ConversaMotor = z.infer<typeof esquemaConversaMotor>;
export type MensagemMotor = z.infer<typeof esquemaMensagemMotor>;
export type EventoConversas = Extract<EventoMotor, { tipo: "conversas" }>;
export type EventoMensagens = Extract<EventoMotor, { tipo: "mensagens" }>;
