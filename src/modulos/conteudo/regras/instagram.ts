// Regras da importação do Instagram (spec C2a, seção 5). Sem rede nem banco.
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";

/** Início do histórico trazido na primeira atualização. */
export const INICIO_HISTORICO_INSTAGRAM = "2026-01-01";
/** Posts publicados há até 30 dias ainda têm os números atualizados todo dia. */
export const DIAS_POSTS_RECENTES = 30;
/** A Meta pode demorar até 48 h para fechar os números da conta: refaz os últimos 7 dias. */
export const DIAS_CONTA_REFEITOS = 7;

/** Permissões que a chave precisa ter para ler o Instagram (spec, seção 3). */
export const PERMISSOES_INSTAGRAM = ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"] as const;

export type TipoMidia = "post" | "carrossel" | "reels" | "story";

const METRICAS_FEED = ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions", "profile_visits"] as const;

/** Métricas pedidas por tipo (regra 5.5): cada tipo só aceita algumas. */
export const METRICAS_POR_TIPO: Record<TipoMidia, readonly string[]> = {
  post: METRICAS_FEED,
  carrossel: METRICAS_FEED,
  reels: ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions"],
  story: ["reach", "views", "shares", "total_interactions", "profile_visits", "replies"],
};

/** Tipo a partir de `media_product_type` e `media_type` (regra 5.3). */
export function tipoDaMidia(m: { media_type?: string; media_product_type?: string }): TipoMidia {
  if (m.media_product_type === "STORY") return "story";
  if (m.media_product_type === "REELS") return "reels";
  if (m.media_type === "CAROUSEL_ALBUM") return "carrossel";
  return "post";
}

const PADRAO_POST = /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i;
const PADRAO_STORY = /instagram\.com\/stories\/[\w.]+\/(\d+)/i;

/** Código do post no link (`/p/<codigo>/`, `/reel/`, `/tv/`; nos stories, o número). `null` se não for post. */
export function codigoDoPermalink(url: string | null | undefined): string | null {
  if (!url) return null;
  return (PADRAO_STORY.exec(url) ?? PADRAO_POST.exec(url))?.[1] ?? null;
}

export type NumerosMidia = {
  alcance: number | null;
  visualizacoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  interacoes: number | null;
  visitasPerfil: number | null;
  respostas: number | null;
};

export type NumerosConta = {
  alcance: number | null;
  visualizacoes: number | null;
  interacoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  cliquesLink: number | null;
  novosSeguidores: number | null;
  deixaramDeSeguir: number | null;
};

export type InsightMeta = {
  name: string;
  values?: { value: number }[];
  total_value?: { value: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] };
};

const CAMPOS_MIDIA: Record<string, keyof NumerosMidia> = {
  reach: "alcance",
  views: "visualizacoes",
  likes: "curtidas",
  comments: "comentarios",
  saved: "salvamentos",
  shares: "compartilhamentos",
  total_interactions: "interacoes",
  profile_visits: "visitasPerfil",
  replies: "respostas",
};

const CAMPOS_CONTA: Record<string, keyof NumerosConta> = {
  reach: "alcance",
  views: "visualizacoes",
  total_interactions: "interacoes",
  likes: "curtidas",
  comments: "comentarios",
  saves: "salvamentos",
  shares: "compartilhamentos",
  profile_links_taps: "cliquesLink",
};

/** Valor de uma métrica (`values[0]` ou `total_value`); ausente vale `null`, nunca 0. */
const valorDe = (i: InsightMeta): number | null => {
  const v = i.total_value?.value ?? i.values?.[0]?.value;
  return typeof v === "number" ? v : null;
};

function ler<T extends Record<string, number | null>>(data: InsightMeta[] | undefined, campos: Record<string, keyof T>, vazio: T): T {
  const numeros = { ...vazio };
  for (const i of data ?? []) {
    const campo = campos[i.name];
    if (campo) numeros[campo] = valorDe(i) as T[keyof T];
  }
  return numeros;
}

export function lerInsightsMidia(data: InsightMeta[] | undefined): NumerosMidia {
  return ler<NumerosMidia>(data, CAMPOS_MIDIA, {
    alcance: null,
    visualizacoes: null,
    curtidas: null,
    comentarios: null,
    salvamentos: null,
    compartilhamentos: null,
    interacoes: null,
    visitasPerfil: null,
    respostas: null,
  });
}

export function lerInsightsConta(data: InsightMeta[] | undefined): NumerosConta {
  const numeros = ler<NumerosConta>(data, CAMPOS_CONTA, {
    alcance: null,
    visualizacoes: null,
    interacoes: null,
    curtidas: null,
    comentarios: null,
    salvamentos: null,
    compartilhamentos: null,
    cliquesLink: null,
    novosSeguidores: null,
    deixaramDeSeguir: null,
  });
  const seguir = data?.find((i) => i.name === "follows_and_unfollows");
  for (const r of seguir?.total_value?.breakdowns?.[0]?.results ?? []) {
    if (r.dimension_values[0] === "FOLLOWER") numeros.novosSeguidores = r.value;
    if (r.dimension_values[0] === "NON_FOLLOWER") numeros.deixaramDeSeguir = r.value;
  }
  return numeros;
}

const ultimoDiaDoMes = (mes: string) => somarDias(`${proximoMes(mes)}-01`, -1);
function proximoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  return m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
}
function mesAnterior(mes: string): string {
  return somarDias(`${mes}-01`, -1).slice(0, 7);
}

/**
 * Dias e meses dos números da conta a pedir (regra 5.7). O mês atual vai até ontem
 * (no dia 1 ainda não tem dia fechado); até o dia 3, o mês anterior é refeito inteiro.
 */
export function periodosConta(o: { hoje: string; primeiraVez: boolean }): {
  dias: string[];
  meses: { mes: string; desde: string; ate: string }[];
} {
  const ontem = somarDias(o.hoje, -1);
  const dias: string[] = [];
  for (let d = o.primeiraVez ? INICIO_HISTORICO_INSTAGRAM : somarDias(o.hoje, -DIAS_CONTA_REFEITOS); d <= ontem; d = somarDias(d, 1))
    dias.push(d);

  const mesAtual = o.hoje.slice(0, 7);
  const primeiro = o.primeiraVez ? INICIO_HISTORICO_INSTAGRAM.slice(0, 7) : Number(o.hoje.slice(8)) <= 3 ? mesAnterior(mesAtual) : mesAtual;
  const meses: { mes: string; desde: string; ate: string }[] = [];
  for (let mes = primeiro; mes <= mesAtual; mes = proximoMes(mes)) {
    const fim = ultimoDiaDoMes(mes);
    const ate = fim < ontem ? fim : ontem;
    if (ate >= `${mes}-01`) meses.push({ mes, desde: `${mes}-01`, ate });
  }
  return { dias, meses };
}

/** Publicado há até 30 dias: os números ainda são atualizados todo dia. */
export function postRecente(publicadoEm: Date, agora: Date): boolean {
  return agora.getTime() - publicadoEm.getTime() <= DIAS_POSTS_RECENTES * 86_400_000;
}

/** Mês ("AAAA-MM") do post no calendário de São Paulo. */
export function mesDoPost(publicadoEm: Date): string {
  return diaEmSaoPaulo(publicadoEm).slice(0, 7);
}

/** Ligação automática (regra 5.12): exatamente uma publicação aprovada ou publicada com o mesmo código no link. */
export function escolherPublicacao(codigo: string, candidatas: { id: string; url: string | null; etapa: string }[]): string | null {
  const achadas = candidatas.filter((c) => (c.etapa === "aprovado" || c.etapa === "publicado") && codigoDoPermalink(c.url) === codigo);
  return achadas.length === 1 ? achadas[0]!.id : null;
}

/** Permissões da seção 3 que a chave não tem, na ordem da spec. */
export function permissoesFaltando(concedidas: { permission: string; status: string }[]): string[] {
  const ok = new Set(concedidas.filter((c) => c.status === "granted").map((c) => c.permission));
  return PERMISSOES_INSTAGRAM.filter((p) => !ok.has(p));
}

export const MENSAGEM_SEM_CONTA_INSTAGRAM =
  "Nenhuma conta do Instagram encontrada. Confira se o usuário do sistema recebeu a Página e a conta do Instagram.";

/** Códigos de limite de uso da Meta: a atualização para os posts e tenta na próxima. */
export const CODIGOS_LIMITE = [4, 17, 32, 613, 80002, 80004] as const;

/** Erro da Graph API em português (regra 5.15). */
export function mensagemErroInstagram(codigo: number | undefined, mensagem: string): string {
  if (codigo === 190) return "A chave de acesso da Meta é inválida ou foi revogada.";
  if (codigo === 10 || codigo === 200) return "A chave não tem permissão para ler o Instagram.";
  if (codigo !== undefined && (CODIGOS_LIMITE as readonly number[]).includes(codigo))
    return "A Meta limitou as consultas. Tente de novo em alguns minutos.";
  return `Erro da Meta: ${mensagem}`;
}

const LIMITE_EM_ANDAMENTO_MS = 30 * 60_000;

/** Uma atualização por vez, por tipo; a que está "em andamento" há mais de 30 minutos é considerada interrompida (regra 5.9). */
export function podeIniciarAtualizacao(emAndamento: { iniciadoEm: Date } | null, agora: Date): { pode: boolean; expirada: boolean } {
  if (!emAndamento) return { pode: true, expirada: false };
  const expirada = agora.getTime() - emAndamento.iniciadoEm.getTime() > LIMITE_EM_ANDAMENTO_MS;
  return { pode: expirada, expirada };
}
