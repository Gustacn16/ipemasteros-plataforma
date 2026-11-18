// Business Discovery da Graph API: lê perfis profissionais PÚBLICOS de outras contas
// usando a conta do Instagram da IPEMaster (chave do Conteúdo C2a). Sem "server-only"
// para poder ser testado com respostas gravadas (fetch injetável).
import { ErroNegocio } from "@/lib/erros";
import { criarPedidosGraph } from "@/lib/meta-graph";
import { mensagemErroInstagram } from "@/modulos/conteudo/regras/instagram";

export type TipoMidiaBD = "post" | "carrossel" | "reels" | "video";

export type MidiaBD = {
  idExterno: string;
  tipo: TipoMidiaBD;
  legenda: string | null;
  permalink: string;
  publicadoEm: Date;
  curtidas: number | null;
  comentarios: number | null;
  visualizacoes: number | null;
  mediaUrl: string | null;
};

export type PerfilBD = {
  usuario: string;
  nome: string | null;
  biografia: string | null;
  site: string | null;
  seguidores: number;
  totalPosts: number;
  midias: MidiaBD[];
};

type MidiaMetaBD = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  view_count?: number;
  media_url?: string;
};

type RespostaBD = {
  business_discovery?: {
    username: string;
    name?: string;
    biography?: string;
    website?: string;
    followers_count?: number;
    media_count?: number;
    media?: { data?: MidiaMetaBD[] };
  };
};

const CAMPOS_MIDIA = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,view_count,media_url";

/** "@Fulano.X " → "fulano.x". Só letras, números, ponto e sublinhado (regra do Instagram). */
export function normalizarUsuarioInstagram(usuario: string): string {
  const limpo = usuario.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(limpo)) throw new ErroNegocio("@ inválido");
  return limpo;
}

function tipoDaMidia(m: MidiaMetaBD): TipoMidiaBD {
  if (m.media_product_type === "REELS") return "reels";
  if (m.media_type === "CAROUSEL_ALBUM") return "carrossel";
  if (m.media_type === "VIDEO") return "video";
  return "post";
}

const numeroOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** O Business Discovery responde 110 quando o perfil não existe ou é pessoal/privado. */
function traduzirErro(codigo: number | undefined, mensagem: string): string {
  if (codigo === 110) return "Perfil não encontrado ou não é uma conta profissional (Business ou Criador de conteúdo).";
  return mensagemErroInstagram(codigo, mensagem);
}

export function criarClienteBusinessDiscovery(token: string, fetchFn: typeof fetch = fetch) {
  const { pedir } = criarPedidosGraph(token, traduzirErro, fetchFn);
  return {
    async perfil(igUserId: string, usuario: string, limiteMidias: number): Promise<PerfilBD> {
      const nome = normalizarUsuarioInstagram(usuario);
      const campos = `business_discovery.username(${nome}){username,name,biography,website,followers_count,media_count,media.limit(${limiteMidias}){${CAMPOS_MIDIA}}}`;
      const corpo = (await pedir<never>(`${encodeURIComponent(igUserId)}?fields=${encodeURIComponent(campos)}`)) as unknown as RespostaBD;
      const bd = corpo.business_discovery;
      if (!bd) throw new ErroNegocio("A Meta não devolveu o perfil.");
      return {
        usuario: bd.username,
        nome: bd.name ?? null,
        biografia: bd.biography ?? null,
        site: bd.website ?? null,
        seguidores: bd.followers_count ?? 0,
        totalPosts: bd.media_count ?? 0,
        midias: (bd.media?.data ?? []).map((m) => ({
          idExterno: m.id,
          tipo: tipoDaMidia(m),
          legenda: m.caption ?? null,
          permalink: m.permalink,
          publicadoEm: new Date(m.timestamp.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")),
          curtidas: numeroOuNulo(m.like_count),
          comentarios: numeroOuNulo(m.comments_count),
          visualizacoes: numeroOuNulo(m.view_count),
          mediaUrl: m.media_url ?? null,
        })),
      };
    },
  };
}

export type ClienteBusinessDiscovery = ReturnType<typeof criarClienteBusinessDiscovery>;
