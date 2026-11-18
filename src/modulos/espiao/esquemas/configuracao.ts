import { z } from "zod";

const MICRO_POR_USD = 1_000_000;
const opcional = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const esquemaConcorrente = z.object({
  nome: z.string().trim().min(2, "Mínimo de 2 caracteres.").max(80, "Máximo de 80 caracteres."),
  instagram: z.preprocess(
    opcional,
    z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, "").toLowerCase())
      .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/, "Use o @ do perfil (letras, números, ponto e _)."))
      .optional(),
  ),
  site: z.preprocess(
    opcional,
    z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .pipe(z.string().regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Informe só o domínio (ex.: concorrente.com.br)."))
      .optional(),
  ),
  observacoes: z.preprocess(opcional, z.string().trim().max(1000, "Máximo de 1000 caracteres.").optional()),
  ativo: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type DadosConcorrente = z.infer<typeof esquemaConcorrente>;

export const esquemaPagina = z.object({
  url: z
    .string()
    .trim()
    .url("Informe o endereço completo (https://…).")
    .refine((u) => /^https?:\/\//i.test(u), "Só endereços http ou https.")
    .refine((u) => u.length <= 500, "Endereço longo demais."),
  rotulo: z.string().trim().min(2, "Mínimo de 2 caracteres.").max(60, "Máximo de 60 caracteres."),
  ativa: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type DadosPagina = z.infer<typeof esquemaPagina>;

export const esquemaTeto = z.object({
  tetoUsd: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Informe um valor em dólares (ex.: 10,00).")
    .transform((v) => Math.round(Number(v.replace(",", ".")) * 100) * (MICRO_POR_USD / 100))
    .refine((micro) => micro >= MICRO_POR_USD && micro <= 100 * MICRO_POR_USD, "O teto deve ficar entre US$ 1 e US$ 100."),
});
