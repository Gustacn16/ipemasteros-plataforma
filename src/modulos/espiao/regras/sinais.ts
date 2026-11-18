// Regras fixas que decidem SE há sinal (spec §6). A IA só descreve depois.
import { fracaoPalavrasMudadas } from "./texto";


export type TipoSinal =
  | "conteudo_destaque"
  | "ritmo_mudou"
  | "seguidores_salto"
  | "pagina_nova"
  | "pagina_mudou"
  | "preco_mudou"
  | "bio_link_mudou";

export type SinalNovo = { tipo: TipoSinal; titulo: string; detalhe: Record<string, unknown>; origemUrl: string | null; chave: string | null };

export type MidiaParaRegra = {
  idExterno: string;
  tipo: "post" | "carrossel" | "reels" | "video";
  permalink: string;
  publicadoEm: Date;
  curtidas: number | null;
  comentarios: number | null;
  visualizacoes: number | null;
  jaSinalizada: boolean;
  resumo: string | null;
};

const DIA_MS = 86_400_000;
const ROTULO_TIPO = { post: "Post", carrossel: "Carrossel", reels: "Reels", video: "Vídeo" } as const;
const vezes = (k: number) => k.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Visualizações para Reels que as trazem; senão curtidas + comentários; sem curtidas, fora da regra. */
function metrica(m: MidiaParaRegra): { tipo: "visualizacoes" | "interacoes"; valor: number } | null {
  if (m.tipo === "reels" && m.visualizacoes !== null) return { tipo: "visualizacoes", valor: m.visualizacoes };
  if (m.curtidas === null) return null;
  return { tipo: "interacoes", valor: m.curtidas + (m.comentarios ?? 0) };
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/** Mídia dos últimos 14 dias com ≥ 3× a mediana das últimas 30 do mesmo tipo e métrica (≥ 5 delas). Uma vez por mídia. */
export function sinaisDeConteudo(midias: MidiaParaRegra[], agora: Date): SinalNovo[] {
  const grupos = new Map<string, { m: MidiaParaRegra; valor: number }[]>();
  for (const m of midias) {
    const x = metrica(m);
    if (!x) continue;
    const chave = `${m.tipo}:${x.tipo}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), { m, valor: x.valor }]);
  }
  const sinais: SinalNovo[] = [];
  for (const itens of grupos.values()) {
    const recentes = [...itens].sort((a, b) => b.m.publicadoEm.getTime() - a.m.publicadoEm.getTime()).slice(0, 30);
    if (recentes.length < 5) continue;
    const med = mediana(recentes.map((i) => i.valor));
    if (med <= 0) continue;
    for (const { m, valor } of recentes) {
      if (m.jaSinalizada || agora.getTime() - m.publicadoEm.getTime() > 14 * DIA_MS) continue;
      const k = valor / med;
      if (k < 3) continue;
      sinais.push({
        tipo: "conteudo_destaque",
        titulo: `${ROTULO_TIPO[m.tipo]} com ${vezes(k)}× a média do perfil`,
        detalhe: { vezes: Math.round(k * 10) / 10, valor, mediana: med, metrica: metrica(m)?.tipo, resumo: m.resumo },
        origemUrl: m.permalink,
        chave: `conteudo_destaque:${m.idExterno}`,
      });
    }
  }
  return sinais;
}

/** Posts dos últimos 7 dias contra a média semanal dos 28 dias anteriores (≥ 4 posts nesse período). */
export function sinalDeRitmo(datasPublicacao: Date[], agora: Date): SinalNovo | null {
  const idade = (d: Date) => agora.getTime() - d.getTime();
  const semana = datasPublicacao.filter((d) => idade(d) >= 0 && idade(d) < 7 * DIA_MS).length;
  const antes = datasPublicacao.filter((d) => idade(d) >= 7 * DIA_MS && idade(d) < 35 * DIA_MS).length;
  if (antes < 4) return null;
  const media = antes / 4;
  const k = semana / media;
  if (k < 2 && k > 0.5) return null;
  const subiu = k >= 2;
  return {
    tipo: "ritmo_mudou",
    titulo: `${subiu ? "Acelerou" : "Diminuiu"} as postagens: ${semana} na semana (média ${vezes(media)})`,
    detalhe: { semana, mediaSemanal: media },
    origemUrl: null,
    chave: null,
  };
}

/** Variação contra a foto mais recente com 5 dias ou mais: +3% ou −2%. */
export function sinalDeSeguidores(atual: number, anterior: { seguidores: number; capturadaEm: Date } | null, agora: Date): SinalNovo | null {
  if (!anterior || anterior.seguidores <= 0) return null;
  if (agora.getTime() - anterior.capturadaEm.getTime() < 5 * DIA_MS) return null;
  const variacao = (atual - anterior.seguidores) / anterior.seguidores;
  if (variacao < 0.03 && variacao > -0.02) return null;
  const pct = (variacao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, signDisplay: "always" });
  return {
    tipo: "seguidores_salto",
    titulo: `Seguidores ${pct}% (${anterior.seguidores.toLocaleString("pt-BR")} → ${atual.toLocaleString("pt-BR")})`,
    detalhe: { antes: anterior.seguidores, depois: atual, variacao },
    origemUrl: null,
    chave: null,
  };
}

type Bio = { biografia: string | null; site: string | null };

export function sinalDeBio(atual: Bio, anterior: Bio | null): SinalNovo | null {
  if (!anterior) return null;
  const mudouBio = (atual.biografia ?? "") !== (anterior.biografia ?? "");
  const mudouSite = (atual.site ?? "") !== (anterior.site ?? "");
  if (!mudouBio && !mudouSite) return null;
  return {
    tipo: "bio_link_mudou",
    titulo: mudouSite ? "Trocou o link da bio" : "Mudou a bio do perfil",
    detalhe: { antes: anterior, depois: atual },
    origemUrl: atual.site,
    chave: null,
  };
}

const mesmoConjunto = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

export function sinaisDePagina(p: {
  url: string;
  rotulo: string;
  /** Última versão LEGÍVEL guardada (null = nunca houve). */
  versaoAnterior: { texto: string; precos: string[] } | null;
  atual: { texto: string; precos: string[]; legivel: boolean };
  ehLinhaDeBase: boolean;
}): SinalNovo[] {
  if (p.ehLinhaDeBase || !p.atual.legivel) return [];
  if (!p.versaoAnterior) {
    return [{ tipo: "pagina_nova", titulo: `Página nova: ${p.rotulo}`, detalhe: { precos: p.atual.precos }, origemUrl: p.url, chave: null }];
  }
  if (!mesmoConjunto(p.versaoAnterior.precos, p.atual.precos)) {
    return [
      {
        tipo: "preco_mudou",
        titulo: `Preço mudou em ${p.rotulo}`,
        detalhe: { antes: p.versaoAnterior.precos, depois: p.atual.precos },
        origemUrl: p.url,
        chave: null,
      },
    ];
  }
  const fracao = fracaoPalavrasMudadas(p.versaoAnterior.texto, p.atual.texto);
  if (fracao < 0.05) return [];
  return [{ tipo: "pagina_mudou", titulo: `Página ${p.rotulo} mudou`, detalhe: { fracao }, origemUrl: p.url, chave: null }];
}
