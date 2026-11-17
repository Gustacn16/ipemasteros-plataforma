import { z } from "zod";

export const esquemaPergunta = z.object({
  conversaId: z.string().cuid().nullable(),
  pergunta: z.string().trim().min(1).max(4000),
  tela: z.string().max(300).nullable(),
});

export type DadosPergunta = z.infer<typeof esquemaPergunta>;
