import { z } from "zod";

/** Eventos que o motor manda para o sistema (QR novo, conectou, caiu, sinal de vida). */
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
]);

export const esquemaLoteEventos = z.object({ eventos: z.array(esquemaEventoMotor).max(500) });

export const esquemaResultadoComando = z.object({
  situacao: z.enum(["concluido", "falhou"]),
  erro: z.string().max(255).optional(),
});

export type EventoMotor = z.infer<typeof esquemaEventoMotor>;
