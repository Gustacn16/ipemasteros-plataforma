import { z } from "zod";
import { FREQUENCIAS, SENTIDOS, lerNumero } from "../regras/indicadores";

export const TIPOS_DOCUMENTO = ["processo", "texto"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export const ROTULO_TIPO_DOCUMENTO: Record<TipoDocumento, string> = { processo: "Processo", texto: "Documento" };
export const AJUDA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  processo: "Ficha do padrão, fluxograma, procedimento e indicadores.",
  texto: "Só texto: missão, políticas, guias.",
};

export const ICONES_CATEGORIA = [
  "pasta",
  "bussola",
  "megafone",
  "alvo",
  "engrenagem",
  "pessoas",
  "graduacao",
  "dinheiro",
  "coracao",
  "grafico",
] as const;
export type IconeCategoria = (typeof ICONES_CATEGORIA)[number];

// Campos chegam como strings de formulário; vazio vira null.
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres`)
    .optional()
    .transform((v) => v || null);

const nome = (max: number) => z.string().trim().min(2, "Informe o nome").max(max, `Use até ${max} caracteres`);
const idOpcional = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((v) => v || null);

export const esquemaCategoria = z.object({
  nome: nome(80),
  descricao: textoOpcional(300),
  icone: z.enum(ICONES_CATEGORIA).catch("pasta"),
});
export type DadosCategoria = z.infer<typeof esquemaCategoria>;

export const esquemaArea = z.object({
  categoriaId: z.string().trim().min(1, "Escolha a categoria"),
  nome: nome(80),
  descricao: textoOpcional(300),
});
export type DadosArea = z.infer<typeof esquemaArea>;

export const esquemaNovoDocumento = z.object({
  areaId: z.string().trim().min(1, "Escolha a área"),
  tipo: z.enum(TIPOS_DOCUMENTO),
  titulo: z.string().trim().min(2, "Informe o título").max(150, "Use até 150 caracteres"),
});
export type DadosNovoDocumento = z.infer<typeof esquemaNovoDocumento>;

const meses = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 36) {
      ctx.addIssue({ code: "custom", message: "Use de 1 a 36 meses" });
      return z.NEVER;
    }
    return n;
  });

export const esquemaDocumento = z.object({
  areaId: z.string().trim().min(1, "Escolha a área"),
  tipo: z.enum(TIPOS_DOCUMENTO),
  titulo: z.string().trim().min(2, "Informe o título").max(150, "Use até 150 caracteres"),
  resumo: textoOpcional(300),
  conteudo: z
    .string()
    .max(200_000, "Texto longo demais")
    .optional()
    .transform((v) => (v?.trim() ? v : null)),
  objetivo: textoOpcional(2000),
  donoId: idOpcional,
  fornecedores: textoOpcional(2000),
  entradas: textoOpcional(2000),
  saidas: textoOpcional(2000),
  clientes: textoOpcional(2000),
  frequencia: textoOpcional(120),
  revisarACadaMeses: meses,
});
export type DadosDocumento = z.infer<typeof esquemaDocumento>;

export const esquemaPublicacao = z.object({
  nota: z.string().trim().min(3, "Conte em poucas palavras o que mudou").max(300, "Use até 300 caracteres"),
});

const numero = (obrigatorio: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) {
        if (obrigatorio) {
          ctx.addIssue({ code: "custom", message: "Informe o valor" });
          return z.NEVER;
        }
        return null;
      }
      const n = lerNumero(v);
      if (n === null || Math.abs(n) >= 1e14) {
        ctx.addIssue({ code: "custom", message: "Número inválido" });
        return z.NEVER;
      }
      return n;
    });

export const esquemaIndicador = z.object({
  nome: nome(120),
  descricao: textoOpcional(2000),
  unidade: z.string().trim().max(20, "Use até 20 caracteres").default(""),
  sentido: z.enum(SENTIDOS),
  meta: numero(false),
  frequencia: z.enum(FREQUENCIAS),
  responsavelId: idOpcional,
});
export type DadosIndicador = z.infer<typeof esquemaIndicador>;

export const esquemaMedicao = z.object({
  /** "aaaa-mm-dd" ou "aaaa-mm" (campo de mês). */
  periodo: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Escolha o período")
    .transform((v) => (v.length === 7 ? `${v}-01` : v)),
  valor: numero(true).transform((v) => v as number),
  analise: textoOpcional(4000),
});
export type DadosMedicao = z.infer<typeof esquemaMedicao>;
