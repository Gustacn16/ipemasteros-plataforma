import { z } from "zod";
import { lerReais } from "@/lib/dinheiro";

export const TIPOS_PRODUTO = ["curso_livre", "paciente_modelo", "pos_graduacao"] as const;
export type TipoProduto = (typeof TIPOS_PRODUTO)[number];

export const ROTULO_TIPO_PRODUTO: Record<TipoProduto, string> = {
  curso_livre: "Curso Livre",
  paciente_modelo: "Paciente Modelo",
  pos_graduacao: "Pós-Graduação",
};

export const FORMAS_PAGAMENTO = ["pix", "cartao", "boleto", "transferencia"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export const TIPOS_COMISSAO = ["valor", "percentual"] as const;
export type TipoComissao = (typeof TIPOS_COMISSAO)[number];

export const ROTULO_TIPO_COMISSAO: Record<TipoComissao, string> = {
  valor: "R$",
  percentual: "%",
};

export const CATEGORIAS_LINK = ["vendas", "aulas", "outro"] as const;
export type CategoriaLink = (typeof CATEGORIAS_LINK)[number];

export const ROTULO_CATEGORIA_LINK: Record<CategoriaLink, string> = {
  vendas: "Vendas",
  aulas: "Aulas",
  outro: "Outro",
};

// Campos chegam como strings de formulário; vazio vira null (ou 0 nos valores).
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres`)
    .optional()
    .transform((v) => v || null);

const inteiroOpcional = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number("Número inválido").int("Use um número inteiro").min(0, "Não pode ser negativo").max(max, `Use até ${max}`).nullable());

const reais = z.string().transform((v, ctx) => {
  const valor = lerReais(v);
  if (valor === null) {
    ctx.addIssue({ code: "custom", message: "Valor inválido" });
    return z.NEVER;
  }
  return valor;
});

const reaisOpcional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v : "0"))
  .pipe(reais);

const marcado = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const url = z
  .string()
  .trim()
  .max(500, "Endereço longo demais")
  .refine((v) => /^https?:\/\//i.test(v) && URL.canParse(v), "Endereço inválido (use http:// ou https://)");

export const esquemaProduto = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome").max(150, "Use até 150 caracteres"),
    tipo: z.enum(TIPOS_PRODUTO, "Tipo inválido"),
    area: textoOpcional(80),
    sku: z
      .string()
      .trim()
      .max(60, "Use até 60 caracteres")
      .optional()
      .transform((v) => (v ? v.toUpperCase() : null)),
    duracaoMeses: inteiroOpcional(240),
    recorrente: marcado,
    responsavelPedagogico: textoOpcional(150),
    corpoDocente: textoOpcional(5000),
    cargaTeoricaPresencial: inteiroOpcional(10000),
    cargaTeoricaSincrona: inteiroOpcional(10000),
    cargaTeoricaAssincrona: inteiroOpcional(10000),
    cargaPratica: inteiroOpcional(10000),
    cargaExtra: inteiroOpcional(10000),
    comissaoTipo: z.enum(TIPOS_COMISSAO).default("valor"),
    comissaoBase: reaisOpcional,
    comissaoBonus: reaisOpcional,
    descricao: textoOpcional(20000),
    ementa: textoOpcional(20000),
    observacoes: textoOpcional(20000),
  })
  .superRefine((p, ctx) => {
    if (p.comissaoTipo !== "percentual") return;
    for (const campo of ["comissaoBase", "comissaoBonus"] as const) {
      if (Number(p[campo]) > 100)
        ctx.addIssue({
          code: "custom",
          path: [campo],
          message: "Percentual deve ser até 100",
        });
    }
  });
export type DadosProduto = z.infer<typeof esquemaProduto>;

export const esquemaOferta = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(80, "Use até 80 caracteres"),
  padrao: marcado,
  precoCheio: reais,
  matricula: reaisOpcional,
  parcelas: z
    .string()
    .trim()
    .optional()
    .transform((v) => Number(v || 0))
    .pipe(z.number("Número inválido").int("Use um número inteiro").min(0, "Não pode ser negativo").max(60, "Use até 60 parcelas")),
  valorParcela: reaisOpcional,
  descontoPontualidadePct: reaisOpcional.refine((v) => Number(v) <= 100, "Percentual deve ser até 100"),
  formasPagamento: z.array(z.enum(FORMAS_PAGAMENTO, "Forma de pagamento inválida")).default([]),
  link: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .pipe(url.nullable()),
});
export type DadosOferta = z.infer<typeof esquemaOferta>;

export const esquemaLink = z.object({
  titulo: z.string().trim().min(1, "Informe o título").max(150, "Use até 150 caracteres"),
  url,
  categoria: z.enum(CATEGORIAS_LINK).default("outro"),
});
export type DadosLink = z.infer<typeof esquemaLink>;

export const esquemaCanal = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(60, "Use até 60 caracteres"),
});
export type DadosCanal = z.infer<typeof esquemaCanal>;

/** Filtros da lista de produtos, vindos da URL. */
export const esquemaFiltrosProdutos = z.object({
  tipo: z.enum(TIPOS_PRODUTO).optional().catch(undefined),
  area: z.string().optional(),
  situacao: z.enum(["ativos", "inativos", "todos"]).catch("ativos"),
});
export type FiltrosProdutos = z.infer<typeof esquemaFiltrosProdutos>;
