export const ROTULO_SINAL: Record<string, string> = {
  conteudo_destaque: "Conteúdo em alta",
  ritmo_mudou: "Ritmo de posts",
  seguidores_salto: "Seguidores",
  pagina_nova: "Página nova",
  pagina_mudou: "Página mudou",
  preco_mudou: "Preço",
  bio_link_mudou: "Bio / link",
};

export const ROTULO_MIDIA: Record<string, string> = { reels: "Reels", post: "Post", carrossel: "Carrossel", video: "Vídeo" };

export const numero = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR"));
export const percentual = (fracao: number | null) =>
  fracao === null ? "—" : `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, signDisplay: "always" })}%`;
export const dataCurta = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "—";
export const dataHora = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
