import { z } from "zod";

/** Cadastro de uma vaga de número: o vendedor precisa de dono; a escola nunca tem. */
export const esquemaNovoNumero = z
  .object({
    nome: z.string().trim().min(1, "Informe o nome do número.").max(60, "O nome pode ter no máximo 60 caracteres."),
    finalidade: z.enum(["escola", "vendedor"]),
    usuarioId: z.string().min(1).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.finalidade === "vendedor" && !v.usuarioId) {
      ctx.addIssue({ code: "custom", path: ["usuarioId"], message: "Escolha o vendedor dono do número." });
    }
  })
  .transform((v) => ({
    nome: v.nome,
    finalidade: v.finalidade,
    usuarioId: v.finalidade === "vendedor" ? (v.usuarioId ?? null) : null,
  }));
