// Formatos por canal: cada canal tem a própria lista (ex.: YouTube → Avulso, Entrevista, Vlog).
import { ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";
import { type Etapa, validarMudancaEtapa } from "./etapas";

/** Formatos criados com o canal (a migration 20261117010000 usa a mesma lista). */
export const FORMATOS_INICIAIS: Record<Plataforma, readonly string[]> = {
  instagram: ["Reels", "Carrossel", "Post", "Story", "Live"],
  youtube: ["Vídeo", "Short", "Live"],
  tiktok: ["Vídeo", "Live"],
  facebook: ["Post", "Vídeo", "Reels"],
  linkedin: ["Post", "Artigo", "Vídeo"],
  newsletter: ["Newsletter"],
  blog: ["Artigo"],
  podcast: ["Episódio"],
  outro: ["Outro"],
};

/** "YouTube · Entrevista"; conteúdo antigo sem formato mostra "Sem formato". */
export function rotuloCanalFormato(o: { plataforma: Plataforma | null; formato: string | null }): string {
  if (!o.plataforma || !o.formato) return "Sem formato";
  return `${ROTULO_PLATAFORMA[o.plataforma]} · ${o.formato}`;
}

/** Etapa em que um conteúdo pode nascer (o + da coluna do quadro). Ele sempre nasce com o canal do formato. */
export function etapaInicialPermitida(etapa: Etapa, podeAprovar: boolean): boolean {
  return etapa !== "cancelado" && validarMudancaEtapa({ para: etapa, podeAprovar, totalCanais: 1 }) === null;
}
