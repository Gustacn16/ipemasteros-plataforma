import { mesesDoAno, somarMeses } from "./meses";

export type Premissa = { produtoId: string; contratoCentavos: number; alunosPorTurma: number; janelaVendasMeses: number; duracaoMeses: number };
export type Turma = {
  id: string;
  produtoId: string;
  codigo: string;
  mesAbertura: string;
  alunos: number | null;
  contratoCentavos: number | null;
  janelaVendasMeses: number | null;
  duracaoMeses: number | null;
};
export type MetaAvulsa = { produtoId: string; mes: string; alunos: number; valorCentavos: number };
export type MetaProdutoMes = { alunos: number; valorCentavos: number };
export type MetasPorProduto = Record<string, MetaProdutoMes>;

/** Números da turma, usando a premissa do produto onde a turma está vazia. */
export function turmaEfetiva(t: Turma, p: Premissa | undefined) {
  return {
    alunos: t.alunos ?? p?.alunosPorTurma ?? 0,
    contratoCentavos: t.contratoCentavos ?? p?.contratoCentavos ?? 0,
    janela: Math.max(1, t.janelaVendasMeses ?? p?.janelaVendasMeses ?? 1),
    duracao: t.duracaoMeses ?? p?.duracaoMeses ?? 0,
  };
}

/** Alunos da turma divididos pelos meses da janela, que termina no mês de abertura. A sobra vai para os últimos meses. */
export function distribuirTurma(t: Turma, p: Premissa | undefined): { mes: string; alunos: number; valorCentavos: number }[] {
  const e = turmaEfetiva(t, p);
  const base = Math.floor(e.alunos / e.janela);
  const sobra = e.alunos % e.janela;
  return Array.from({ length: e.janela }, (_, i) => {
    const alunos = base + (i >= e.janela - sobra ? 1 : 0);
    return { mes: somarMeses(t.mesAbertura, i - (e.janela - 1)), alunos, valorCentavos: alunos * e.contratoCentavos };
  });
}

function somar(alvo: MetasPorProduto, produtoId: string, alunos: number, valorCentavos: number) {
  const atual = alvo[produtoId] ?? { alunos: 0, valorCentavos: 0 };
  alvo[produtoId] = { alunos: atual.alunos + alunos, valorCentavos: atual.valorCentavos + valorCentavos };
}

/** Meta de vendas por mês e produto: turmas + metas avulsas. O que cai fora do ano vai para antes/depois. */
export function metasDeVendas(ano: number, premissas: Premissa[], turmas: Turma[], avulsas: MetaAvulsa[]) {
  const porMes: Record<string, MetasPorProduto> = Object.fromEntries(mesesDoAno(ano).map((m) => [m, {}]));
  const antes: MetasPorProduto = {};
  const depois: MetasPorProduto = {};
  const porProduto = new Map(premissas.map((p) => [p.produtoId, p]));
  const lancar = (produtoId: string, mes: string, alunos: number, valor: number) => {
    if (alunos === 0 && valor === 0) return;
    const alvo = porMes[mes] ?? (mes < `${ano}-01` ? antes : depois);
    somar(alvo, produtoId, alunos, valor);
  };
  for (const t of turmas) for (const m of distribuirTurma(t, porProduto.get(t.produtoId))) lancar(t.produtoId, m.mes, m.alunos, m.valorCentavos);
  for (const a of avulsas) lancar(a.produtoId, a.mes, a.alunos, a.valorCentavos);
  return { porMes, antes, depois };
}

export function totalDoMes(metas: MetasPorProduto): MetaProdutoMes {
  return Object.values(metas).reduce((s, m) => ({ alunos: s.alunos + m.alunos, valorCentavos: s.valorCentavos + m.valorCentavos }), {
    alunos: 0,
    valorCentavos: 0,
  });
}
