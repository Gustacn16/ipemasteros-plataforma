// Pipeline de produção de conteúdo (docs/modulos/conteudo.md).

export const ETAPAS = [
  "ideia",
  "planejado",
  "a_gravar",
  "gravado",
  "edicao",
  "revisao",
  "aprovado",
  "publicado",
  "cancelado",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ROTULO_ETAPA: Record<Etapa, string> = {
  ideia: "Ideia",
  planejado: "Planejado",
  a_gravar: "A gravar",
  gravado: "Gravado",
  edicao: "Edição",
  revisao: "Revisão",
  aprovado: "Aprovado",
  publicado: "Publicado",
  cancelado: "Cancelado",
};

export const COR_ETAPA: Record<Etapa, string> = {
  ideia: "#a3a3a3",
  planejado: "#8b5cf6",
  a_gravar: "#f97316",
  gravado: "#eab308",
  edicao: "#3b82f6",
  revisao: "#ec4899",
  aprovado: "#14b8a6",
  publicado: "#22c55e",
  cancelado: "#737373",
};

/** Colunas do quadro de planejamento (publicado e cancelado ficam fora). */
export const ETAPAS_DO_QUADRO = ETAPAS.filter((e) => e !== "publicado" && e !== "cancelado");

/** Etapas que o usuário escolhe à mão (publicado é automático). */
export const ETAPAS_SELECIONAVEIS = ETAPAS.filter((e) => e !== "publicado");

const EXIGEM_CANAL: readonly Etapa[] = ["planejado", "a_gravar", "gravado", "edicao", "revisao", "aprovado"];

type Mudanca = { para: Etapa; podeAprovar: boolean; totalCanais: number };

/** Retorna a mensagem de erro da mudança de etapa, ou null se permitida. */
export function validarMudancaEtapa({ para, podeAprovar, totalCanais }: Mudanca): string | null {
  if (para === "publicado") return "O conteúdo vira publicado sozinho quando todas as publicações nos canais forem marcadas.";
  if (para === "aprovado" && !podeAprovar) return "Só admin ou gestor aprova conteúdo.";
  if (EXIGEM_CANAL.includes(para) && totalCanais === 0) return "Escolha pelo menos um canal de destino antes de avançar.";
  return null;
}

export type StatusPublicacao = "pendente" | "publicado";

/** Etapa do conteúdo depois de marcar ou desmarcar publicações (regra 3). */
export function etapaAposPublicacoes(etapaAtual: Etapa, status: readonly StatusPublicacao[]): Etapa {
  const todas = status.length > 0 && status.every((s) => s === "publicado");
  if (etapaAtual === "aprovado" && todas) return "publicado";
  if (etapaAtual === "publicado" && !todas) return "aprovado";
  return etapaAtual;
}
