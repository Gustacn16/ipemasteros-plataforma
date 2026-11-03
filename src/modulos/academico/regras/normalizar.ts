import type { SituacaoMatricula } from "../esquemas/academico";

// Normalizações usadas na importação da planilha e nos cadastros (spec Acadêmico 1, §6).

/** Sem acento, minúsculo e com espaços colapsados: chave para achar o aluno. */
export function nomeBusca(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const texto = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** Só os dígitos, ou null se não sobrar nenhum. */
export function soDigitos(v: unknown): string | null {
  const d = texto(v).replace(/\D/g, "");
  return d || null;
}

/** O Excel entrega CRM numérico (28117 ou "28117.0"): vira "28117". */
export function normalizarCrm(v: unknown): string | null {
  if (typeof v === "number") return String(v);
  const t = texto(v).replace(/\.0+$/, "");
  return t ? t.slice(0, 20) : null;
}

const ORDINAL = /^(\d{1,2})\s*(?:ª|°|º|a|o)?\s*turma$/i;

/** "4° turma" → "4ª turma"; "cíclico" → turma "Cíclica". */
export function normalizarTurma(v: unknown): { nome: string; ciclica: boolean } | null {
  const t = texto(v).replace(/\s+/g, " ");
  if (!t) return null;
  const chave = nomeBusca(t);
  if (chave === "ciclico" || chave === "ciclica") return { nome: "Cíclica", ciclica: true };
  const m = ORDINAL.exec(t);
  if (m) return { nome: `${Number(m[1])}ª turma`, ciclica: false };
  return { nome: t.slice(0, 60), ciclica: false };
}

export const NOTA_FINALIZOU_PRATICAS = "Finalizou as práticas; aguardando formatura";

const SITUACOES: Record<string, SituacaoMatricula> = {
  ativo: "ativa",
  ativa: "ativa",
  "finalizou as praticas": "ativa",
  trancado: "trancada",
  trancada: "trancada",
  formado: "concluida",
  formada: "concluida",
  concluido: "concluida",
  concluida: "concluida",
  cancelado: "cancelada",
  cancelada: "cancelada",
};

/** Situação da planilha → situação da matrícula, ou null se desconhecida. */
export function normalizarSituacao(v: unknown): { situacao: SituacaoMatricula; nota: string | null } | null {
  const chave = nomeBusca(texto(v));
  const situacao = SITUACOES[chave];
  if (!situacao) return null;
  return { situacao, nota: chave === "finalizou as praticas" ? NOTA_FINALIZOU_PRATICAS : null };
}
