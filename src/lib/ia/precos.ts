export const MODELOS_IA = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] as const;
export type ModeloIa = (typeof MODELOS_IA)[number];

export const ROTULO_MODELO: Record<ModeloIa, string> = {
  "claude-haiku-5-5": "Haiku 5.5 (mais barato)",
  "claude-sonnet-5-5": "Sonnet 5.5",
  "claude-opus-5-5": "Opus 5.5 (mais inteligente)",
};

export type TokensUso = { entrada: number; cacheEscrita: number; cacheLeitura: number; saida: number };

type UsageAnthropic = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

export function tokensDoUsage(usage: UsageAnthropic): TokensUso {
  return {
    entrada: usage.input_tokens ?? 0,
    cacheEscrita: usage.cache_creation_input_tokens ?? 0,
    cacheLeitura: usage.cache_read_input_tokens ?? 0,
    saida: usage.output_tokens ?? 0,
  };
}

// US$ por milhão de tokens equivale a micro-dólares por token. Para evitar erro de ponto flutuante,
// os preços ficam em milésimos de micro-dólar por token (inteiros) e o total é dividido por 1000 no fim.
type Preco = { entrada: number; escrita: number; leitura: number; saida: number };

const ESCALA = 1000;

function preco(entrada: number, saida: number, leitura: number): Preco {
  return {
    entrada: Math.round(entrada * ESCALA),
    escrita: Math.round(entrada * 1.25 * ESCALA),
    leitura: Math.round(leitura * ESCALA),
    saida: Math.round(saida * ESCALA),
  };
}

const LIMITE_FAIXA_HAIKU = 100_000;
const HAIKU_ATE_100K = preco(0.1, 0.5, 0.01);
const HAIKU_ACIMA_100K = preco(0.5, 2.5, 0.05);
const SONNET = preco(2, 10, 0.1);
const OPUS = preco(4, 20, 0.2);

function precoDoModelo(modelo: ModeloIa, t: TokensUso): Preco {
  if (modelo === "claude-sonnet-5-5") return SONNET;
  if (modelo === "claude-opus-5-5") return OPUS;
  const entradaTotal = t.entrada + t.cacheEscrita + t.cacheLeitura;
  return entradaTotal > LIMITE_FAIXA_HAIKU ? HAIKU_ACIMA_100K : HAIKU_ATE_100K;
}

/** Custo em micro-dólares (US$ 1 = 1.000.000), inteiro, arredondado para cima. */
export function calcularCustoMicroUsd(modelo: ModeloIa, t: TokensUso): number {
  const p = precoDoModelo(modelo, t);
  const total = t.entrada * p.entrada + t.cacheEscrita * p.escrita + t.cacheLeitura * p.leitura + t.saida * p.saida;
  return Math.ceil(total / ESCALA);
}
