import { z } from "zod";
import { MODELOS_IA } from "@/lib/ia/precos";

const MICRO_POR_USD = 1_000_000;

const limiteMensalUsd = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d{1,2})?$/, "Informe um valor em dólares, com até 2 casas (ex.: 20,00).")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100) * (MICRO_POR_USD / 100))
  .refine((micro) => micro >= 1 * MICRO_POR_USD && micro <= 1000 * MICRO_POR_USD, "O limite deve ficar entre US$ 1 e US$ 1.000.");

export const esquemaConfiguracaoIa = z
  .object({
    modelo: z.enum(MODELOS_IA, { error: "Escolha um modelo da lista." }),
    limiteMensalUsd,
    perguntasPorDia: z.coerce
      .number({ error: "Informe um número." })
      .int("Use um número inteiro.")
      .min(1, "Mínimo de 1 pergunta por dia.")
      .max(500, "Máximo de 500 perguntas por dia."),
  })
  .transform(({ limiteMensalUsd: micro, ...resto }) => ({ ...resto, limiteMensalMicroUsd: micro }));

export type DadosConfiguracaoIa = z.output<typeof esquemaConfiguracaoIa>;
