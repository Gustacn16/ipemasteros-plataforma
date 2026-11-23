import { z } from "zod";

/** Metas que o plano calcula sozinho (turmas + funil). */
export const CHAVES_META_CALCULADA = [
  "vendas_valor",
  "vendas_alunos",
  "leads",
  "reunioes_agendadas",
  "reunioes_realizadas",
  "investimento_midia",
  "cac_por_aluno",
  "conversao_lead_venda",
] as const;
export type ChaveMetaCalculada = (typeof CHAVES_META_CALCULADA)[number];

/** De onde vem o realizado. Tudo que não é "manual" vem sozinho da plataforma. */
export const FONTES = [
  "manual",
  "vendas_valor",
  "vendas_alunos",
  "meta_leads",
  "meta_investimento",
  "instagram_seguidores",
  "instagram_alcance",
  "conteudos_publicados",
  "calc_cac",
  "calc_conversao",
] as const;
export type Fonte = (typeof FONTES)[number];

export const ROTULO_FONTE: Record<Fonte, string> = {
  manual: "Lançado à mão",
  vendas_valor: "Vendas registradas (R$)",
  vendas_alunos: "Vendas registradas (quantidade)",
  meta_leads: "Leads da Meta (formulário + site + conversas)",
  meta_investimento: "Investimento na Meta",
  instagram_seguidores: "Seguidores do Instagram (fim do mês)",
  instagram_alcance: "Alcance do Instagram no mês",
  conteudos_publicados: "Conteúdos publicados",
  calc_cac: "CAC por aluno (mídia + comissão ÷ alunos)",
  calc_conversao: "Conversão lead → venda (alunos ÷ leads)",
};

export const fonteAutomatica = (f: string) => f !== "manual";

export type ParametrosFonte = { contaId?: string; canalId?: string; formatoId?: string };

/** Parâmetros de cada fonte: Instagram pede a conta; conteúdos pedem o canal (formato opcional). */
export function validarParametrosFonte(fonte: Fonte, p: ParametrosFonte): string | null {
  if ((fonte === "instagram_seguidores" || fonte === "instagram_alcance") && !p.contaId) return "Escolha a conta do Instagram.";
  if (fonte === "conteudos_publicados" && !p.canalId) return "Escolha o canal.";
  return null;
}

export const esquemaParametrosFonte = z.object({
  contaId: z.string().min(1).optional(),
  canalId: z.string().min(1).optional(),
  formatoId: z.string().min(1).optional(),
});
