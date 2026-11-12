// Análise dos posts do Instagram para a aba Relatórios: desempenho por formato, dia e horário,
// destaques e sugestões de conteúdo calculadas a partir dos números (sem IA).
import type { TipoMidia } from "./instagram";

export type PostAnalise = {
  id: string;
  tipo: TipoMidia;
  /** Título do conteúdo ligado ou o começo da legenda. */
  titulo: string;
  legenda: string | null;
  permalink?: string;
  publicadoEm: Date;
  alcance: number | null;
  visualizacoes: number | null;
  interacoes: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  comentarios: number | null;
};

/** Dias de posts analisados para formatos, horários e sugestões. */
export const DIAS_ANALISE = 90;
/** Um grupo (formato, dia, período) só vira conclusão com pelo menos esta quantidade de posts. */
const MIN_POSTS_GRUPO = 3;
/** Sugestões só com pelo menos esta quantidade de posts com números. */
const MIN_POSTS_SUGESTAO = 5;
/** O maior engajamento só conta posts que chegaram a um público mínimo. */
const MIN_ALCANCE_DESTAQUE = 100;

export const ROTULO_TIPO: Record<TipoMidia, string> = { post: "Post", carrossel: "Carrossel", reels: "Reels", story: "Story" };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const PERIODOS = [
  { chave: "madrugada", rotulo: "Madrugada (0h–6h)", ate: 6 },
  { chave: "manha", rotulo: "Manhã (6h–12h)", ate: 12 },
  { chave: "tarde", rotulo: "Tarde (12h–18h)", ate: 18 },
  { chave: "noite", rotulo: "Noite (18h–24h)", ate: 24 },
] as const;
const NOME_PERIODO: Record<string, string> = { madrugada: "de madrugada", manha: "de manhã", tarde: "à tarde", noite: "à noite" };

const partesSP = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hourCycle: "h23" });
const SEMANA_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function quandoEmSP(d: Date): { dia: number; hora: number } {
  const p = partesSP.formatToParts(d);
  return { dia: SEMANA_EN.indexOf(p.find((x) => x.type === "weekday")!.value), hora: Number(p.find((x) => x.type === "hour")!.value) };
}

const vezes = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const media = (valores: number[]) => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null);
const comNumeros = (posts: PostAnalise[]) => posts.filter((p): p is PostAnalise & { alcance: number } => p.alcance !== null);

/** Interações sobre alcance, em % com uma casa. */
export function engajamento(alcance: number | null, interacoes: number | null): number | null {
  if (!alcance || interacoes === null) return null;
  return Math.round((interacoes / alcance) * 1000) / 10;
}

export type LinhaFormato = {
  tipo: TipoMidia;
  quantidade: number;
  alcanceMedio: number;
  visualizacoesMedia: number | null;
  engajamento: number | null;
  salvamentosMedio: number | null;
  compartilhamentosMedio: number | null;
};

/** Médias por formato, do maior alcance médio para o menor; posts sem números ficam de fora. */
export function desempenhoPorFormato(posts: PostAnalise[]): LinhaFormato[] {
  const grupos = new Map<TipoMidia, (PostAnalise & { alcance: number })[]>();
  for (const p of comNumeros(posts)) grupos.set(p.tipo, [...(grupos.get(p.tipo) ?? []), p]);
  const mediaDe = (g: PostAnalise[], campo: "visualizacoes" | "salvamentos" | "compartilhamentos") => {
    const m = media(g.map((p) => p[campo]).filter((v): v is number => v !== null));
    return m === null ? null : Math.round(m);
  };
  return [...grupos]
    .map(([tipo, g]) => {
      const alcance = g.reduce((s, p) => s + p.alcance, 0);
      const interacoes = g.reduce((s, p) => s + (p.interacoes ?? 0), 0);
      return {
        tipo,
        quantidade: g.length,
        alcanceMedio: Math.round(alcance / g.length),
        visualizacoesMedia: mediaDe(g, "visualizacoes"),
        engajamento: engajamento(alcance, interacoes),
        salvamentosMedio: mediaDe(g, "salvamentos"),
        compartilhamentosMedio: mediaDe(g, "compartilhamentos"),
      };
    })
    .sort((a, b) => b.alcanceMedio - a.alcanceMedio);
}

export type Faixa = { chave: string; rotulo: string; quantidade: number; alcanceMedio: number | null };

function faixas(posts: PostAnalise[], grupos: { chave: string; rotulo: string }[], chaveDe: (d: Date) => string): Faixa[] {
  // Stories duram 24 horas e têm outro público: o melhor horário é dos posts do feed e dos Reels.
  const feed = comNumeros(posts).filter((p) => p.tipo !== "story");
  return grupos.map((g) => {
    const alcances = feed.filter((p) => chaveDe(p.publicadoEm) === g.chave).map((p) => p.alcance);
    const m = media(alcances);
    return { ...g, quantidade: alcances.length, alcanceMedio: m === null ? null : Math.round(m) };
  });
}

/** Alcance médio por dia da semana (domingo a sábado), no horário de São Paulo. */
export function porDiaDaSemana(posts: PostAnalise[]): Faixa[] {
  return faixas(
    posts,
    DIAS.map((rotulo, i) => ({ chave: String(i), rotulo })),
    (d) => String(quandoEmSP(d).dia),
  );
}

/** Alcance médio por período do dia, no horário de São Paulo. */
export function porPeriodoDoDia(posts: PostAnalise[]): Faixa[] {
  return faixas(
    posts,
    PERIODOS.map(({ chave, rotulo }) => ({ chave, rotulo })),
    (d) => PERIODOS.find((p) => quandoEmSP(d).hora < p.ate)!.chave,
  );
}

export type Destaques = {
  maisSalvo: PostAnalise | null;
  maisCompartilhado: PostAnalise | null;
  maisComentado: PostAnalise | null;
  maiorEngajamento: PostAnalise | null;
};

function maior(posts: PostAnalise[], valor: (p: PostAnalise) => number | null): PostAnalise | null {
  let melhor: PostAnalise | null = null;
  for (const p of posts) {
    const v = valor(p);
    if (v !== null && v > 0 && (melhor === null || v > valor(melhor)!)) melhor = p;
  }
  return melhor;
}

/** Os posts que se destacaram em salvamentos, compartilhamentos, comentários e engajamento. */
export function destaques(posts: PostAnalise[]): Destaques {
  return {
    maisSalvo: maior(posts, (p) => p.salvamentos),
    maisCompartilhado: maior(posts, (p) => p.compartilhamentos),
    maisComentado: maior(posts, (p) => p.comentarios),
    maiorEngajamento: maior(
      posts.filter((p) => (p.alcance ?? 0) >= MIN_ALCANCE_DESTAQUE),
      (p) => engajamento(p.alcance, p.interacoes),
    ),
  };
}

const PALAVRAS_COMUNS = new Set(
  (
    "para pela pelo pelos pelas como mais menos muito muita muitos muitas sobre isso esse essa esses essas este esta estes estas " +
    "aqui você vocês voce voces nosso nossa nossos nossas seus suas quando onde qual quais quem porque cada todo toda todos todas " +
    "também tambem ainda depois antes agora hoje amanhã ontem fazer faz feito pode podem será sera está estão estao temos tenho " +
    "então entao assim nada tudo algo alguém alguem coisa coisas dia dias link perfil comenta comente siga clique saiba veja confira"
  ).split(" "),
);

function termos(legenda: string | null): Set<string> {
  const texto = (legenda ?? "").toLocaleLowerCase("pt-BR");
  const hashtags = texto.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const palavras = (texto.replace(/#[\p{L}\p{N}_]+/gu, " ").match(/\p{L}{4,}/gu) ?? []).filter((p) => !PALAVRAS_COMUNS.has(p));
  return new Set([...hashtags, ...palavras]);
}

/**
 * Palavras e hashtags que se repetem nos posts de maior alcance (o quarto de cima, pelo menos 3 posts)
 * e aparecem bem menos no resto. Até 5, da mais repetida para a menos.
 */
export function temasEmAlta(posts: PostAnalise[]): string[] {
  const ordenados = comNumeros(posts).sort((a, b) => b.alcance - a.alcance);
  if (ordenados.length < 2 * MIN_POSTS_GRUPO) return [];
  const corte = Math.max(MIN_POSTS_GRUPO, Math.ceil(ordenados.length / 4));
  const contar = (lista: PostAnalise[]) => {
    const c = new Map<string, number>();
    for (const p of lista) for (const t of termos(p.legenda)) c.set(t, (c.get(t) ?? 0) + 1);
    return c;
  };
  const topo = ordenados.slice(0, corte);
  const resto = ordenados.slice(corte);
  const noTopo = contar(topo);
  const noResto = contar(resto);
  return [...noTopo]
    .filter(([t, n]) => n >= 2 && n / topo.length > 1.5 * ((noResto.get(t) ?? 0) / Math.max(resto.length, 1)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

export type Sugestao = { titulo: string; texto: string; postId?: string };

/** O grupo com alcance médio pelo menos `fator` vezes a média geral, com posts suficientes. */
function melhorFaixa(lista: Faixa[], mediaGeral: number, fator: number): Faixa | null {
  const validas = lista.filter((f) => f.quantidade >= MIN_POSTS_GRUPO && f.alcanceMedio !== null);
  const melhor = validas.sort((a, b) => b.alcanceMedio! - a.alcanceMedio!)[0];
  return melhor && melhor.alcanceMedio! >= fator * mediaGeral ? melhor : null;
}

/** Sugestões de conteúdo a partir dos posts que mais funcionaram (regras fixas, sem IA). */
export function sugestoesDeConteudo(posts: PostAnalise[]): Sugestao[] {
  const validos = comNumeros(posts);
  if (validos.length < MIN_POSTS_SUGESTAO) return [];
  const s: Sugestao[] = [];

  const formatos = desempenhoPorFormato(validos).filter((f) => f.quantidade >= MIN_POSTS_GRUPO);
  const [primeiro, segundo] = formatos;
  if (primeiro && segundo && primeiro.alcanceMedio >= 1.3 * segundo.alcanceMedio) {
    const nome = ROTULO_TIPO[primeiro.tipo];
    s.push({
      titulo: `Priorize ${nome}`,
      texto: `${nome} alcança em média ${vezes.format(primeiro.alcanceMedio / segundo.alcanceMedio)}× mais pessoas que ${ROTULO_TIPO[segundo.tipo]}.`,
    });
  }
  const maisEngaja = [...formatos].filter((f) => f.engajamento !== null).sort((a, b) => b.engajamento! - a.engajamento!)[0];
  if (maisEngaja && formatos.length > 1 && maisEngaja.tipo !== primeiro?.tipo) {
    s.push({
      titulo: `${ROTULO_TIPO[maisEngaja.tipo]} engaja mais`,
      texto: `${ROTULO_TIPO[maisEngaja.tipo]} tem a maior taxa de engajamento (${vezes.format(maisEngaja.engajamento!)}%): use para conversar com quem já segue.`,
    });
  }

  const temas = temasEmAlta(validos);
  if (temas.length > 0) {
    s.push({
      titulo: "Temas que funcionam",
      texto: `Os posts de maior alcance falam de: ${temas.join(", ")}. Faça mais conteúdos nesses temas.`,
    });
  }

  const feed = validos.filter((p) => p.tipo !== "story");
  const mediaFeed = media(feed.map((p) => p.alcance));
  if (mediaFeed) {
    const dia = melhorFaixa(porDiaDaSemana(feed), mediaFeed, 1.2);
    if (dia) {
      s.push({
        titulo: `Poste na ${dia.rotulo.toLocaleLowerCase("pt-BR")}`,
        texto: `Posts de ${dia.rotulo.toLocaleLowerCase("pt-BR")} alcançam ${Math.round((dia.alcanceMedio! / mediaFeed - 1) * 100)}% mais que a média.`,
      });
    }
    const periodo = melhorFaixa(porPeriodoDoDia(feed), mediaFeed, 1.2);
    if (periodo) {
      s.push({
        titulo: `Poste ${NOME_PERIODO[periodo.chave]}`,
        texto: `Posts ${NOME_PERIODO[periodo.chave]} alcançam ${Math.round((periodo.alcanceMedio! / mediaFeed - 1) * 100)}% mais que a média.`,
      });
    }
  }

  const d = destaques(validos);
  const mediaDe = (campo: "salvamentos" | "compartilhamentos") => media(validos.map((p) => p[campo] ?? 0)) ?? 0;
  if (d.maisSalvo && d.maisSalvo.salvamentos! >= 2 * mediaDe("salvamentos")) {
    s.push({
      titulo: "Faça uma continuação",
      texto: `"${d.maisSalvo.titulo}" foi o mais salvo: conteúdo de referência funciona. Vale uma parte 2 ou uma série.`,
      postId: d.maisSalvo.id,
    });
  }
  if (d.maisCompartilhado && d.maisCompartilhado.compartilhamentos! >= 2 * mediaDe("compartilhamentos")) {
    s.push({
      titulo: "Repita o que é compartilhado",
      texto: `"${d.maisCompartilhado.titulo}" foi o mais compartilhado: é o que traz gente nova. Faça outro no mesmo estilo.`,
      postId: d.maisCompartilhado.id,
    });
  }
  return s;
}
