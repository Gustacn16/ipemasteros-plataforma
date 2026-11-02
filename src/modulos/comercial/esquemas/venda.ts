import { z } from "zod";
import { lerReais } from "@/lib/dinheiro";
import { normalizarWhatsapp } from "@/modulos/core/regras/perfil";
import { PERIODOS } from "@/modulos/tarefas/regras/relatorio";
import { valorTotal } from "../regras/venda";
import { FORMAS_PAGAMENTO } from "./produto";

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

const dia = z.string("Informe a data").regex(FORMATO_DIA, "Informe a data");
const diaOpcional = z
  .string()
  .optional()
  .transform((v) => v || null)
  .pipe(z.string().regex(FORMATO_DIA, "Data inválida").nullable());

const idOpcional = z
  .string()
  .optional()
  .transform((v) => v || null);

const reaisOpcional = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const valor = lerReais(v?.trim() ? v : "0");
    if (valor === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido" });
      return z.NEVER;
    }
    return valor;
  });

export const esquemaVenda = z
  .object({
    produtoId: z.string("Escolha o produto").min(1, "Escolha o produto"),
    ofertaId: idOpcional,
    vendedorId: z.string("Escolha o vendedor").min(1, "Escolha o vendedor"),
    dataVenda: dia,
    dataEntradaLead: diaOpcional,
    nomeCliente: z.string().trim().min(2, "Informe o nome do cliente").max(150, "Use até 150 caracteres"),
    whatsappCliente: z
      .string()
      .optional()
      .transform((v) => (v?.trim() ? normalizarWhatsapp(v) : null))
      .refine((v) => v === null || /^\d{10,11}$/.test(v), "WhatsApp inválido"),
    canalId: idOpcional,
    dataEntrega: diaOpcional,
    metodoPagamento: z.enum(FORMAS_PAGAMENTO, "Escolha o método de pagamento"),
    entrada: reaisOpcional,
    numeroParcelas: z
      .string()
      .trim()
      .optional()
      .transform((v) => Number(v || 0))
      .pipe(z.number("Número inválido").int("Use um número inteiro").min(0, "Não pode ser negativo").max(60, "Use até 60 parcelas")),
    valorParcela: reaisOpcional,
    primeiroVencimento: diaOpcional,
    observacoes: z
      .string()
      .trim()
      .max(2000, "Use até 2000 caracteres")
      .optional()
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (Number(valorTotal(v.entrada, v.numeroParcelas, v.valorParcela)) <= 0) {
      ctx.addIssue({ code: "custom", path: ["entrada"], message: "Informe o valor da venda" });
    }
    if (v.dataEntradaLead && v.dataEntradaLead > v.dataVenda) {
      ctx.addIssue({ code: "custom", path: ["dataEntradaLead"], message: "O lead não pode ter entrado depois da venda" });
    }
  });
export type DadosVenda = z.infer<typeof esquemaVenda>;

const diaFiltro = z.string().regex(FORMATO_DIA).optional().catch(undefined);

/** Filtros da lista de vendas, vindos da URL. */
export const esquemaFiltrosVendas = z.object({
  periodo: z.enum(PERIODOS).catch("mes"),
  de: diaFiltro,
  ate: diaFiltro,
  produto: z.string().optional(),
  vendedor: z.string().optional(),
  canal: z.string().optional(),
});
export type FiltrosVendas = z.infer<typeof esquemaFiltrosVendas>;
