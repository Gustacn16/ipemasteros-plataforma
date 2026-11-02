import { z } from "zod";
import { ETAPAS, ETAPAS_SELECIONAVEIS } from "../regras/etapas";

export const PLATAFORMAS = ["instagram", "youtube", "tiktok", "facebook", "linkedin", "newsletter", "blog", "podcast", "outro"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  newsletter: "Newsletter",
  blog: "Blog",
  podcast: "Podcast",
  outro: "Outro",
};

export const COR_PLATAFORMA: Record<Plataforma, string> = {
  instagram: "#e1306c",
  youtube: "#ff0000",
  tiktok: "#111111",
  facebook: "#1877f2",
  linkedin: "#0a66c2",
  newsletter: "#2563eb",
  blog: "#16a34a",
  podcast: "#8b5cf6",
  outro: "#737373",
};

export const FORMATOS = ["reels", "carrossel", "post", "story", "video", "short", "live", "newsletter", "artigo", "outro"] as const;
export type Formato = (typeof FORMATOS)[number];

export const ROTULO_FORMATO: Record<Formato, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  post: "Post",
  story: "Story",
  video: "Vídeo",
  short: "Short",
  live: "Live",
  newsletter: "Newsletter",
  artigo: "Artigo",
  outro: "Outro",
};

const id = z.string().min(1);
const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").transform((c) => c.toLowerCase());
const textoOpcional = (max: number) =>
  z
    .string()
    .max(max, "Texto longo demais")
    .nullish()
    .transform((v) => v?.trim() || null);
const data = z
  .union([z.literal(""), z.iso.date("Data inválida")])
  .nullish()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));
const link = z
  .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Link inválido (use http ou https)" }).max(500)])
  .nullish()
  .transform((v) => v || null);

export const esquemaMarca = z.object({ nome: z.string().trim().min(1, "Informe o nome").max(60), cor });
export const esquemaEditarMarca = esquemaMarca.extend({ marcaId: id });

export const esquemaCanal = z.object({
  marcaId: id,
  plataforma: z.enum(PLATAFORMAS),
  identificador: textoOpcional(100),
});
export const esquemaEditarCanal = z.object({ canalId: id, identificador: textoOpcional(100), ativo: z.boolean() });

export const esquemaNovoConteudo = z.object({
  marcaId: id,
  titulo: z.string().trim().min(1, "Informe o título").max(200, "Título longo demais"),
  formato: z.enum(FORMATOS),
  canalIds: z.array(id).max(20),
  dataPublicacao: data,
});

export const esquemaAtualizarConteudo = esquemaNovoConteudo.omit({ marcaId: true }).extend({
  conteudoId: id,
  roteiro: textoOpcional(50_000),
  legenda: textoOpcional(10_000),
  linkMaterial: link,
  responsavelId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  dataGravacao: data,
});

export const esquemaMudarEtapa = z.object({ conteudoId: id, etapa: z.enum(ETAPAS_SELECIONAVEIS) });

const numero = z
  .union([z.literal(""), z.coerce.number().int("Use número inteiro").min(0).max(2_000_000_000)])
  .nullish()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const esquemaRegistrarPublicacao = z.object({
  publicacaoId: id,
  publicado: z.boolean(),
  url: link,
  data: data,
});

export const esquemaMetricas = z.object({
  publicacaoId: id,
  alcance: numero,
  visualizacoes: numero,
  curtidas: numero,
  comentarios: numero,
  compartilhamentos: numero,
  salvamentos: numero,
});

const idOpcional = z.string().min(1).max(40).optional().catch(undefined);

/** Filtro das visões do módulo. Cada campo inválido é ignorado em vez de quebrar a página. */
export const esquemaFiltroConteudo = z.object({
  marca: idOpcional,
  canal: idOpcional,
  responsavel: idOpcional,
  formato: z.enum(FORMATOS).optional().catch(undefined),
  etapa: z.enum(ETAPAS).optional().catch(undefined),
});
export type FiltroConteudo = z.infer<typeof esquemaFiltroConteudo>;

/** O filtro fica salvo neste cookie (só ids e códigos) até a pessoa limpar. */
export const COOKIE_FILTRO = "conteudo_filtro";

export function filtroDoCookie(valor: string | undefined): FiltroConteudo {
  if (!valor) return {};
  try {
    const r = esquemaFiltroConteudo.safeParse(JSON.parse(valor));
    return r.success ? limparFiltro(r.data) : {};
  } catch {
    return {};
  }
}

/** Remove os campos vazios. */
export function limparFiltro(f: FiltroConteudo): FiltroConteudo {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as FiltroConteudo;
}

export const esquemaMes = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .optional()
  .catch(undefined);
