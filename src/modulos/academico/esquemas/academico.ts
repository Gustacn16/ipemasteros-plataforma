import { z } from "zod";

export const SITUACOES_TURMA = ["planejada", "em_andamento", "concluida", "cancelada"] as const;
export type SituacaoTurma = (typeof SITUACOES_TURMA)[number];

export const ROTULO_SITUACAO_TURMA: Record<SituacaoTurma, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const SITUACOES_MATRICULA = ["ativa", "trancada", "concluida", "cancelada"] as const;
export type SituacaoMatricula = (typeof SITUACOES_MATRICULA)[number];

export const ROTULO_SITUACAO_MATRICULA: Record<SituacaoMatricula, string> = {
  ativa: "Ativa",
  trancada: "Trancada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// Campos chegam como strings de formulário; vazio vira null.
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres`)
    .optional()
    .transform((v) => v || null);

const nome = z.string().trim().min(2, "Informe o nome").max(150, "Use até 150 caracteres");

const email = z
  .string()
  .trim()
  .max(150, "Use até 150 caracteres")
  .optional()
  .transform((v) => v || null)
  .pipe(z.email("E-mail inválido").nullable());

const telefone = z
  .string()
  .optional()
  .transform((v) => v?.replace(/\D/g, "") || null)
  .pipe(z.string().min(8, "Telefone inválido").max(20, "Telefone inválido").nullable());

const crmUf = z
  .string()
  .trim()
  .optional()
  .transform((v) => v?.toUpperCase() || null)
  .pipe(z.enum(UFS, "UF inválida").nullable());

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
/** O dia existe no calendário (recusa "2026-02-30"). */
const diaExiste = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
};
const diaOpcional = z
  .string()
  .optional()
  .transform((v) => v || null)
  .pipe(z.string().regex(FORMATO_DIA, "Data inválida").refine(diaExiste, "Data inválida").nullable());

const marcado = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const depoisDoInicio = (inicio: string | null, fim: string | null) => !inicio || !fim || fim >= inicio;

export const esquemaTurma = z
  .object({
    produtoId: z.string("Escolha o produto").min(1, "Escolha o produto"),
    nome: z.string().trim().min(1, "Informe o nome").max(60, "Use até 60 caracteres"),
    ciclica: marcado,
    dataInicio: diaOpcional,
    dataFim: diaOpcional,
    situacao: z.enum(SITUACOES_TURMA, "Situação inválida").default("planejada"),
    observacoes: textoOpcional(5000),
  })
  .refine((t) => depoisDoInicio(t.dataInicio, t.dataFim), { path: ["dataFim"], message: "O fim vem depois do início" });
export type DadosTurma = z.infer<typeof esquemaTurma>;

export const esquemaAluno = z.object({
  nome,
  email,
  telefone,
  crm: textoOpcional(20),
  crmUf,
  observacoes: textoOpcional(5000),
});
export type DadosAluno = z.infer<typeof esquemaAluno>;

export const esquemaMatricula = z
  .object({
    turmaId: z.string("Escolha a turma").min(1, "Escolha a turma"),
    situacao: z.enum(SITUACOES_MATRICULA, "Situação inválida").default("ativa"),
    dataInicio: diaOpcional,
    dataFormatura: diaOpcional,
    vigencia: textoOpcional(40),
    plano: textoOpcional(255),
    observacoes: textoOpcional(5000),
  })
  .refine((m) => depoisDoInicio(m.dataInicio, m.dataFormatura), {
    path: ["dataFormatura"],
    message: "A formatura vem depois do início",
  });
export type DadosMatricula = z.infer<typeof esquemaMatricula>;

export const esquemaProfessor = z.object({
  nome,
  email,
  telefone,
  crm: textoOpcional(20),
  crmUf,
  especialidade: textoOpcional(120),
  miniCurriculo: textoOpcional(10000),
});
export type DadosProfessor = z.infer<typeof esquemaProfessor>;
