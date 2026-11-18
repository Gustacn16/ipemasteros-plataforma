export type IndicadorConcorrente = {
  concorrente: string;
  seguidores: number | null;
  /** Fração (0,1 = +10%). */
  variacaoSeguidores: number | null;
  postsPorSemana: number;
  /** Em %, com 2 casas. */
  engajamentoMedio: number | null;
  destaques: string[];
};
