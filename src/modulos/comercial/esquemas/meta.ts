import { z } from "zod";
import { lerReais } from "@/lib/dinheiro";
import { mesAtual } from "../regras/meta";

/** "AAAA-MM" com mês 01–12. */
const FORMATO_MES = /^(20[2-9]\d|2100)-(0[1-9]|1[0-2])$/;

/** Mês vindo da URL; inválido ou ausente vira o mês atual em São Paulo. */
export const esquemaMes = (agora: Date) => z.string().regex(FORMATO_MES).catch(mesAtual(agora));

const linhaMeta = z.object({
  vendedorId: z.string().min(1),
  valorAlvo: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const valor = lerReais(v?.trim() ? v : "0");
      if (valor === null) {
        ctx.addIssue({ code: "custom", message: "Valor inválido" });
        return z.NEVER;
      }
      return valor;
    }),
  quantidadeAlvo: z
    .string()
    .trim()
    .optional()
    .transform((v) => Number(v || 0))
    .pipe(z.number("Quantidade inválida").int("Use um número inteiro").min(0, "Não pode ser negativa").max(10000, "Use até 10000")),
});

/** Metas de um produto num mês: uma linha por vendedor. */
export const esquemaMetasProduto = z.object({
  mes: z.string().regex(FORMATO_MES, "Mês inválido"),
  produtoId: z.string().min(1),
  linhas: z.array(linhaMeta),
});
export type DadosMetasProduto = z.infer<typeof esquemaMetasProduto>;
