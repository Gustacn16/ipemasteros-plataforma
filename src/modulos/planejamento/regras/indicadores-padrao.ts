import type { Sentido, Tipo } from "./desempenho";
import type { PremissasFunil } from "./funil";
import type { ChaveMetaCalculada, Fonte } from "./fontes";

export type Frente = "comercial" | "marketing";
export type Unidade = "numero" | "reais" | "percentual";
export type IndicadorPadrao = {
  frente: Frente;
  grupo: string;
  nome: string;
  unidade: Unidade;
  sentido: Sentido;
  tipo: Tipo;
  metaCalculada: ChaveMetaCalculada | null;
  fonte: Fonte;
  metaMensalInicial: number | null;
};

/** Premissas do funil da planilha "[2027] OKRs e Metas". */
export const PREMISSAS_FUNIL_PADRAO: PremissasFunil = {
  convLeadAgendada: 0.2,
  comparecimento: 0.75,
  convReuniaoVenda: 0.25,
  custoPorLeadCentavos: 15_000,
  comissaoPct: 0.05,
  tetoCacPct: 0.1,
};

const comercial = (nome: string, metaCalculada: ChaveMetaCalculada, fonte: Fonte, extra: Partial<IndicadorPadrao> = {}): IndicadorPadrao => ({
  frente: "comercial",
  grupo: "Funil comercial",
  nome,
  unidade: "numero",
  sentido: "maior_melhor",
  tipo: "fluxo",
  metaCalculada,
  fonte,
  metaMensalInicial: null,
  ...extra,
});

const marketing = (grupo: string, nome: string, metaMensalInicial: number | null, extra: Partial<IndicadorPadrao> = {}): IndicadorPadrao => ({
  frente: "marketing",
  grupo,
  nome,
  unidade: "numero",
  sentido: "maior_melhor",
  tipo: "fluxo",
  metaCalculada: null,
  fonte: "manual",
  metaMensalInicial,
  ...extra,
});

export const INDICADORES_PADRAO: IndicadorPadrao[] = [
  comercial("Vendas (R$)", "vendas_valor", "vendas_valor", { unidade: "reais" }),
  comercial("Alunos vendidos", "vendas_alunos", "vendas_alunos"),
  comercial("Leads gerados", "leads", "meta_leads"),
  comercial("Reuniões agendadas", "reunioes_agendadas", "manual"),
  comercial("Reuniões realizadas", "reunioes_realizadas", "manual"),
  comercial("Investimento em mídia (R$)", "investimento_midia", "meta_investimento", { unidade: "reais", sentido: "menor_melhor" }),
  comercial("CAC por aluno", "cac_por_aluno", "calc_cac", { unidade: "reais", sentido: "menor_melhor", tipo: "taxa" }),
  comercial("Conversão lead → venda", "conversao_lead_venda", "calc_conversao", { unidade: "percentual", tipo: "taxa" }),
  // Meta por mês digitada e realizado lançado à mão (quantos pacientes modelo foram captados).
  { frente: "comercial", grupo: "Pacientes modelo", nome: "Pacientes modelo", unidade: "numero", sentido: "maior_melhor", tipo: "fluxo", metaCalculada: null, fonte: "manual", metaMensalInicial: null },
  marketing("Conteúdo e audiência", "Posts no feed — IPEMaster", 20),
  marketing("Conteúdo e audiência", "Reels / vídeos curtos", 12),
  marketing("Conteúdo e audiência", "Vídeos no YouTube", 4),
  marketing("Conteúdo e audiência", "Seguidores Instagram IPEMaster", null, { tipo: "estoque" }),
  marketing("Conteúdo e audiência", "Alcance no mês", null),
  marketing("Conteúdo e audiência", "Seguidores Pedro Prado", null, { tipo: "estoque" }),
  marketing("Newsletter", "Edições enviadas", 4),
  marketing("Newsletter", "Inscritos", null, { tipo: "estoque" }),
  marketing("Newsletter", "Taxa de abertura", 0.35, { unidade: "percentual", tipo: "taxa" }),
  marketing("Podcast", "Episódios publicados", 4),
  marketing("Podcast", "Plays / views", null),
  marketing("Eventos", "Eventos realizados", 1),
  marketing("Eventos", "Leads vindos de conteúdo orgânico", null),
];
