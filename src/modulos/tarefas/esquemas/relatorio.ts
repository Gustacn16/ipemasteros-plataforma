import { z } from "zod";
import { PERIODOS } from "../regras/relatorio";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

/** Filtros do relatório vindos da URL; valor inválido vira o padrão. */
export const esquemaFiltrosRelatorio = z.object({
  periodo: z.enum(PERIODOS).catch("mes"),
  de: dia,
  ate: dia,
  espaco: z.string().optional(),
  pessoa: z.string().optional(),
});
export type FiltrosRelatorio = z.infer<typeof esquemaFiltrosRelatorio>;
