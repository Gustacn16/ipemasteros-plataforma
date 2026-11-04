import { z } from "zod";
import { CATEGORIAS_CAMPANHA } from "../regras/midia";
import { esquemaMes } from "./meta";

const filtroOpcional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const MAX_CAMPANHAS = 50;

/**
 * Filtros do dashboard vindos da URL: visão (vendas ou mídia), mês (padrão: atual),
 * produto e vendedor (vendas) e os filtros de campanha (mídia).
 */
export const esquemaFiltrosDashboard = (agora: Date) =>
  z.object({
    visao: z.enum(["vendas", "midia"]).catch("vendas"),
    mes: esquemaMes(agora),
    produto: filtroOpcional,
    vendedor: filtroOpcional,
    conta: filtroOpcional,
    campanhas: z
      .string()
      .optional()
      .transform((v) =>
        [
          ...new Set(
            (v ?? "")
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
          ),
        ].slice(0, MAX_CAMPANHAS),
      ),
    busca: z
      .string()
      .max(100)
      .optional()
      .catch(undefined)
      .transform((v) => v?.trim() || undefined),
    situacao: z.enum(["todas", "ativas", "pausadas"]).catch("todas"),
    categoria: z.enum(CATEGORIAS_CAMPANHA).optional().catch(undefined),
  });
export type FiltrosDashboard = z.infer<ReturnType<typeof esquemaFiltrosDashboard>>;
