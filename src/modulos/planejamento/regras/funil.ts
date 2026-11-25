import type { MetaProdutoMes } from "./turmas";

/** Percentuais como fração (0.2 = 20%). */
export type PremissasFunil = {
  convLeadAgendada: number;
  comparecimento: number;
  convReuniaoVenda: number;
  custoPorLeadCentavos: number;
  comissaoPct: number;
  tetoCacPct: number;
};

export type FunilMes = {
  alunos: number;
  valorCentavos: number;
  reunioesRealizadas: number | null;
  reunioesAgendadas: number | null;
  leads: number | null;
  verbaCentavos: number | null;
  comissaoCentavos: number;
  cacTotalCentavos: number | null;
  cacPorAlunoCentavos: number | null;
  cacPct: number | null;
  acimaDoTeto: boolean;
  /** Teto de CAC por aluno: teto (% do vendido) × vendido ÷ alunos. É a meta do CAC por aluno. */
  cacTetoPorAlunoCentavos?: number | null;
};

// Arredonda para cima, tolerando o erro de ponto flutuante (28.000000001 → 28).
const teto = (v: number) => Math.ceil(Math.round(v * 1e6) / 1e6);
const dividirParaCima = (v: number | null, d: number) => (v === null || d <= 0 ? null : teto(v / d));

/** O que precisa acontecer no mês para bater a meta, de trás para frente. */
export function calcularFunil(meta: MetaProdutoMes, p: PremissasFunil): FunilMes {
  const reunioesRealizadas = dividirParaCima(meta.alunos, p.convReuniaoVenda);
  const reunioesAgendadas = dividirParaCima(reunioesRealizadas, p.comparecimento);
  const leads = dividirParaCima(reunioesAgendadas, p.convLeadAgendada);
  const verbaCentavos = leads === null ? null : leads * p.custoPorLeadCentavos;
  const comissaoCentavos = Math.round(meta.valorCentavos * p.comissaoPct);
  const cacTotalCentavos = verbaCentavos === null ? null : verbaCentavos + comissaoCentavos;
  const cacPorAlunoCentavos = cacTotalCentavos === null || meta.alunos === 0 ? null : Math.round(cacTotalCentavos / meta.alunos);
  const cacPct = cacTotalCentavos === null || meta.valorCentavos === 0 ? null : cacTotalCentavos / meta.valorCentavos;
  return {
    alunos: meta.alunos,
    valorCentavos: meta.valorCentavos,
    reunioesRealizadas,
    reunioesAgendadas,
    leads,
    verbaCentavos,
    comissaoCentavos,
    cacTotalCentavos,
    cacPorAlunoCentavos,
    cacPct,
    acimaDoTeto: cacPct !== null && p.tetoCacPct > 0 && cacPct > p.tetoCacPct,
    cacTetoPorAlunoCentavos: p.tetoCacPct > 0 && meta.alunos > 0 ? Math.round((p.tetoCacPct * meta.valorCentavos) / meta.alunos) : null,
  };
}

export const conversaoGeral = (p: PremissasFunil) => p.convLeadAgendada * p.comparecimento * p.convReuniaoVenda;
