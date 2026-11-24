import { z } from "zod";
import { MAX_GRUPOS_POR_AVISO, MAX_TEXTO_AVISO } from "../regras/avisos";

/** `agendadoPara` chega como horário local de São Paulo, `YYYY-MM-DDTHH:MM`. */
const HORARIO_LOCAL = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const esquemaAviso = z.object({
  id: z.string().min(1).max(40).optional(),
  texto: z
    .string()
    .trim()
    .min(1, "Escreva o texto do aviso.")
    .max(MAX_TEXTO_AVISO, `O texto pode ter no máximo ${MAX_TEXTO_AVISO} caracteres.`),
  agendadoPara: z
    .string()
    .regex(HORARIO_LOCAL, "Informe a data e a hora do envio.")
    .refine((s) => !Number.isNaN(new Date(`${s}:00-03:00`).getTime()), "Informe uma data válida."),
  grupos: z
    .array(z.string().min(1).max(40))
    .min(1, "Escolha ao menos um grupo.")
    .max(MAX_GRUPOS_POR_AVISO, `Um aviso vai a no máximo ${MAX_GRUPOS_POR_AVISO} grupos.`)
    .transform((ids) => [...new Set(ids)]),
});

export type DadosAviso = z.infer<typeof esquemaAviso>;

/** Converte o horário local de São Paulo (UTC-3 fixo) para um instante. */
export function horarioSaoPauloParaData(s: string): Date {
  return new Date(`${s}:00-03:00`);
}
