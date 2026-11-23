import { z } from "zod";
import { lerReais } from "@/lib/dinheiro";
import { lerNumero } from "@/lib/numeros";
import { FONTES, esquemaParametrosFonte } from "../regras/fontes";

// Campos chegam como strings de formulário.
const texto = z.string().trim();
const centavosDe = (reais: string) => Math.round(Number(reais) * 100);

export const esquemaAno = z.coerce.number().int().min(2020, "Ano inválido.").max(2100, "Ano inválido.");
export const esquemaMesPlano = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido.");

const percentual = texto.transform((v, ctx) => {
  const n = lerNumero(v);
  if (n === null || n < 0 || n > 100) {
    ctx.addIssue({ code: "custom", message: "Use um valor entre 0 e 100." });
    return z.NEVER;
  }
  return n / 100;
});

const reaisObrigatorio = texto.transform((v, ctx) => {
  const r = lerReais(v);
  if (r === null) {
    ctx.addIssue({ code: "custom", message: "Valor em reais inválido." });
    return z.NEVER;
  }
  return centavosDe(r);
});

const reaisOpcional = texto.optional().transform((v, ctx) => {
  if (!v) return null;
  const r = lerReais(v);
  if (r === null) {
    ctx.addIssue({ code: "custom", message: "Valor em reais inválido." });
    return z.NEVER;
  }
  return centavosDe(r);
});

const inteiroOpcional = (min: number, max: number) =>
  texto.optional().transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: `Use um número inteiro de ${min} a ${max}.` });
      return z.NEVER;
    }
    return n;
  });

const inteiro = (min: number, max: number) => z.coerce.number().int(`Use um número inteiro.`).min(min, `Mínimo ${min}.`).max(max, `Máximo ${max}.`);

export const esquemaPremissasFunil = z.object({
  convLeadAgendada: percentual,
  comparecimento: percentual,
  convReuniaoVenda: percentual,
  custoPorLead: reaisObrigatorio,
  comissaoPct: percentual,
  tetoCacPct: percentual,
}).transform(({ custoPorLead, ...r }) => ({ ...r, custoPorLeadCentavos: custoPorLead }));
export type DadosPremissasFunil = z.infer<typeof esquemaPremissasFunil>;

export const esquemaPremissaProduto = z.object({
  produtoId: texto.min(1, "Escolha o produto."),
  contratoMedio: reaisObrigatorio,
  alunosPorTurma: inteiro(1, 500),
  janelaVendasMeses: inteiro(1, 24),
  duracaoMeses: inteiro(1, 60),
});
export type DadosPremissaProduto = z.infer<typeof esquemaPremissaProduto>;

export const esquemaTurma = z
  .object({
    produtoId: texto.min(1, "Escolha o produto."),
    codigo: texto.min(1, "Informe o código (ex.: T5).").max(20, "Use até 20 caracteres."),
    mesAbertura: esquemaMesPlano,
    alunos: inteiroOpcional(1, 500),
    contratoMedio: reaisOpcional,
    janelaVendasMeses: inteiroOpcional(1, 24),
    duracaoMeses: inteiroOpcional(1, 60),
    observacoes: texto.max(300, "Use até 300 caracteres.").optional().transform((v) => v || null),
  })
  .transform(({ contratoMedio, ...r }) => ({ ...r, contratoCentavos: contratoMedio }));
export type DadosTurma = z.infer<typeof esquemaTurma>;

export const esquemaMetaAvulsa = z.object({
  produtoId: texto.min(1, "Escolha o produto."),
  mes: esquemaMesPlano,
  alunos: inteiroOpcional(0, 5000),
  valor: reaisOpcional,
});
export type DadosMetaAvulsa = z.infer<typeof esquemaMetaAvulsa>;

export const esquemaIndicador = z.object({
  frente: z.enum(["comercial", "marketing"]),
  grupo: texto.max(60, "Use até 60 caracteres.").default(""),
  nome: texto.min(2, "Informe o nome.").max(120, "Use até 120 caracteres."),
  unidade: z.enum(["numero", "reais", "percentual"]),
  sentido: z.enum(["maior_melhor", "menor_melhor"]),
  tipo: z.enum(["fluxo", "estoque", "taxa"]),
  fonte: z.enum(FONTES),
  fonteParametros: esquemaParametrosFonte.default({}),
  responsavelId: texto.optional().transform((v) => v || null),
  noPainel: z.boolean().default(true),
});
export type DadosIndicador = z.infer<typeof esquemaIndicador>;

const numeroOpcional = texto.optional().transform((v, ctx) => {
  if (!v) return null;
  const n = lerNumero(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: "Número inválido." });
    return z.NEVER;
  }
  return n;
});

/** Metas digitadas de um indicador: { "2027-01": "20", ... }. Vazio apaga. Percentual chega como "35" (o serviço divide). */
export const esquemaMetasIndicador = z.object({
  indicadorId: texto.min(1),
  valores: z.record(esquemaMesPlano, numeroOpcional),
});
export type DadosMetasIndicador = z.infer<typeof esquemaMetasIndicador>;

export const esquemaLancamento = z.object({
  indicadorId: texto.min(1),
  mes: esquemaMesPlano,
  valor: numeroOpcional,
  observacao: texto.max(300, "Use até 300 caracteres.").optional().transform((v) => v || null),
});
export type DadosLancamento = z.infer<typeof esquemaLancamento>;
