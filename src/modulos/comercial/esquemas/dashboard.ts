import { z } from "zod";
import { esquemaMes } from "./meta";

const filtroOpcional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

/** Filtros do dashboard vindos da URL: mês (padrão: atual), produto e vendedor. */
export const esquemaFiltrosDashboard = (agora: Date) =>
  z.object({
    mes: esquemaMes(agora),
    produto: filtroOpcional,
    vendedor: filtroOpcional,
  });
export type FiltrosDashboard = z.infer<ReturnType<typeof esquemaFiltrosDashboard>>;
