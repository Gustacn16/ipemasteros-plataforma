import { z } from "zod";

/** Telefone digitado com ou sem máscara: sobram só os dígitos, de 10 a 13. */
export const esquemaTelefoneTitular = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().min(10, "Informe o telefone com DDD.").max(13, "O telefone tem dígitos demais."));

export const esquemaApagarDadosTelefone = z.object({ telefone: esquemaTelefoneTitular });
