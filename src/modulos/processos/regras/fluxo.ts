import { z } from "zod";

// Fluxograma de um processo: lista ordenada de etapas. A ordem é a numeração
// mostrada na tela (1, 2, 3…). Decisões apontam "Sim"/"Não" para outras etapas.

export const TIPOS_ETAPA = ["etapa", "decisao", "fim"] as const;
export type TipoEtapa = (typeof TIPOS_ETAPA)[number];
export const ROTULO_TIPO_ETAPA: Record<TipoEtapa, string> = { etapa: "Etapa", decisao: "Decisão", fim: "Fim / resultado" };

export const MAXIMO_ETAPAS = 30;

const texto = (max: number) => z.string().trim().max(max).default("");

export const esquemaEtapa = z.object({
  id: z.string().trim().min(1).max(40),
  tipo: z.enum(TIPOS_ETAPA),
  titulo: z.string().trim().min(1, "Dê um título à etapa.").max(80),
  descricao: texto(300),
  responsavel: texto(80),
  sim: z.string().max(40).nullable().default(null),
  nao: z.string().max(40).nullable().default(null),
});
export type Etapa = z.infer<typeof esquemaEtapa>;

export const esquemaFluxo = z.array(esquemaEtapa).max(MAXIMO_ETAPAS, `No máximo ${MAXIMO_ETAPAS} etapas.`);

/** Limpa destinos que apontam para etapas que não existem e campos que não valem para o tipo. */
function limpar(etapas: Etapa[]): Etapa[] {
  const ids = new Set(etapas.map((e) => e.id));
  const valido = (id: string | null, proprio: string) => (id && ids.has(id) && id !== proprio ? id : null);
  return etapas.map((e) =>
    e.tipo === "decisao" ? { ...e, sim: valido(e.sim, e.id), nao: valido(e.nao, e.id) } : { ...e, sim: null, nao: null },
  );
}

/** Valida o fluxo enviado pelo editor. Lança ZodError se vier fora do formato. */
export function validarFluxo(entrada: unknown): Etapa[] {
  const etapas = esquemaFluxo.parse(entrada);
  if (new Set(etapas.map((e) => e.id)).size !== etapas.length) {
    throw new z.ZodError([{ code: "custom", path: ["fluxo"], message: "Etapas repetidas no fluxo.", input: entrada }]);
  }
  return limpar(etapas);
}

/** Lê o fluxo guardado no banco. Formato inválido vira fluxo vazio (nunca quebra a página). */
export function lerFluxo(json: unknown): Etapa[] {
  const r = esquemaFluxo.safeParse(json ?? []);
  return r.success ? limpar(r.data) : [];
}

/** Para onde vai o "Sim" de uma decisão: o destino escolhido ou a próxima etapa. */
export function destinoSim(etapas: Etapa[], indice: number): number | null {
  const e = etapas[indice];
  if (!e) return null;
  if (e.sim) {
    const i = etapas.findIndex((x) => x.id === e.sim);
    return i >= 0 ? i : null;
  }
  return indice + 1 < etapas.length ? indice + 1 : null;
}

export function destinoNao(etapas: Etapa[], indice: number): number | null {
  const e = etapas[indice];
  if (!e?.nao) return null;
  const i = etapas.findIndex((x) => x.id === e.nao);
  return i >= 0 ? i : null;
}

/** Texto do fluxo para a busca. */
export function textoDoFluxo(etapas: Etapa[]): string {
  return etapas.map((e) => `${e.titulo} ${e.descricao} ${e.responsavel}`).join(" ");
}
