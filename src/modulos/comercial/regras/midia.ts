// Contas da visão de mídia do dashboard (spec Meta Ads, seção 5.9). Dinheiro em centavos.

/** Mês em que as vendas passaram a ser registradas no sistema: antes dele, CAC e ROAS não fazem sentido. */
export const INICIO_VENDAS_NO_SISTEMA = "2026-11";

export type FiltroCampanhas = {
  conta?: string;
  campanhas: string[];
  busca?: string;
  situacao: "todas" | "ativas" | "pausadas";
  categoria?: CategoriaCampanha;
};

/** Com filtro de campanha, CAC e ROAS ficam de fora: as vendas não estão ligadas a uma campanha. */
export function filtrandoCampanhas(f: FiltroCampanhas): boolean {
  return Boolean(f.conta) || f.campanhas.length > 0 || Boolean(f.busca) || f.situacao !== "todas" || Boolean(f.categoria);
}

const reais = (c: number) => (c / 100).toFixed(2);

export function custoPorLead(investimentoCentavos: number, leads: number): string | null {
  return leads === 0 ? null : reais(Math.round(investimentoCentavos / leads));
}

/** Investimento ÷ vendas do mês. */
export function cac(investimentoCentavos: number, vendas: number, mes: string): string | null {
  if (vendas === 0 || mes < INICIO_VENDAS_NO_SISTEMA) return null;
  return reais(Math.round(investimentoCentavos / vendas));
}

/** Vendido ÷ investimento, com uma casa decimal. */
export function roas(vendidoCentavos: number, investimentoCentavos: number, mes: string): number | null {
  if (investimentoCentavos === 0 || mes < INICIO_VENDAS_NO_SISTEMA) return null;
  return Math.round((vendidoCentavos / investimentoCentavos) * 10) / 10;
}

/** 4.2 → "4,2x". */
export function formatarRoas(r: number | null): string {
  return r === null ? "—" : `${r.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x`;
}

export function totalLeads(l: { leadsFormulario: number; leadsSite: number; conversasIniciadas: number }): number {
  return l.leadsFormulario + l.leadsSite + l.conversasIniciadas;
}

/**
 * Descarta conta e campanhas que não existem mais, são de conta desligada ou não
 * pertencem à conta escolhida (link antigo, por exemplo), em vez de zerar tudo.
 */
export function filtrosValidos<F extends FiltroCampanhas>(
  f: F,
  validos: { contas: string[]; campanhas: { id: string; contaId: string }[] },
): F {
  const conta = f.conta && validos.contas.includes(f.conta) ? f.conta : undefined;
  const permitidas = new Set(validos.campanhas.filter((c) => !conta || c.contaId === conta).map((c) => c.id));
  return { ...f, conta, campanhas: f.campanhas.filter((id) => permitidas.has(id)) };
}

/** Lista do filtro de campanhas: ativas primeiro (cada grupo em ordem de nome), respeitando a situação escolhida. */
export function campanhasDaLista<C extends { nome: string; status: string }>(campanhas: C[], situacao: FiltroCampanhas["situacao"]): C[] {
  const ativa = (c: C) => c.status === "ACTIVE";
  return campanhas
    .filter((c) => situacao === "todas" || (situacao === "ativas" ? ativa(c) : !ativa(c)))
    .sort((a, b) => Number(ativa(b)) - Number(ativa(a)) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export const CATEGORIAS_CAMPANHA = ["transplante", "psiquiatria", "paciente_modelo", "outras"] as const;
export type CategoriaCampanha = (typeof CATEGORIAS_CAMPANHA)[number];

export const ROTULO_CATEGORIA: Record<CategoriaCampanha, string> = {
  transplante: "Pós Transplante Capilar",
  psiquiatria: "Psiquiatria",
  paciente_modelo: "Paciente Modelo",
  outras: "Outras",
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Categoria pelo nome da campanha (pedido do usuário em 2026-11-04). A ordem importa:
 * "Paciente Modelo Transplante" é Paciente Modelo, não Transplante.
 */
export function categoriaDaCampanha(nome: string): CategoriaCampanha {
  const n = semAcento(nome);
  if (n.includes("paciente modelo")) return "paciente_modelo";
  if (n.includes("psiq")) return "psiquiatria";
  if (/\btct\b/.test(n) || n.includes("transplante")) return "transplante";
  return "outras";
}

/** CTR do link em %, com duas casas. */
export function ctr(cliquesLink: number, impressoes: number): number | null {
  return impressoes === 0 ? null : Math.round((cliquesLink / impressoes) * 10000) / 100;
}

/** Custo por clique no link. */
export function cpc(investimentoCentavos: number, cliquesLink: number): string | null {
  return cliquesLink === 0 ? null : reais(Math.round(investimentoCentavos / cliquesLink));
}

/** Gasto mínimo no mês para um criativo entrar no ranking (R$ 50, em centavos). */
export const INVESTIMENTO_MINIMO_RANKING = 5000;

export type CriativoDoMes = {
  id: string;
  nome: string;
  campanha: string;
  miniatura: string | null;
  investimento: number;
  impressoes: number;
  cliquesLink: number;
  leads: number;
};

/**
 * Ranking dos criativos pelo menor custo por lead (pedido em 2026-11-04). Só entra quem
 * gastou pelo menos R$ 50 e trouxe lead; empate vai para quem trouxe mais leads.
 */
export function rankingCriativos(itens: CriativoDoMes[], limite = 10) {
  const elegiveis = itens.filter((c) => c.investimento >= INVESTIMENTO_MINIMO_RANKING);
  const ranking = elegiveis
    .filter((c) => c.leads > 0)
    .sort((a, b) => a.investimento * b.leads - b.investimento * a.leads || b.leads - a.leads || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite)
    .map((c, i) => ({
      id: c.id,
      nome: c.nome,
      campanha: c.campanha,
      miniatura: c.miniatura,
      posicao: i + 1,
      investimento: reais(c.investimento),
      leads: c.leads,
      cpl: custoPorLead(c.investimento, c.leads),
      ctr: ctr(c.cliquesLink, c.impressoes),
      cpc: cpc(c.investimento, c.cliquesLink),
    }));
  return { ranking, semLead: elegiveis.filter((c) => c.leads === 0).length };
}
