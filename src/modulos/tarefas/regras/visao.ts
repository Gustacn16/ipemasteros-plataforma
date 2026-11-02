export const VISOES = ["lista", "quadro"] as const;
export type Visao = (typeof VISOES)[number];

/** Cookie com a visualização preferida (Lista ou Quadro). */
export const COOKIE_VISAO = "tarefas_visao";

export function lerVisao(valor: string | undefined): Visao {
  return valor === "quadro" ? "quadro" : "lista";
}
