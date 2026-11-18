// Categorias seguras dos erros da coleta: vão para o banco e para a tela, nunca o texto original.
import { ErroNegocio } from "@/lib/erros";
import { ErroMeta } from "@/lib/meta-graph";

export const TEXTO_ERRO = {
  perfil_nao_profissional: "O perfil não existe ou não é uma conta profissional (Business ou Criador de conteúdo).",
  chave_meta: "A chave da Meta está inválida ou sem permissão para ler o Instagram.",
  meta: "A Meta não respondeu como esperado. A próxima coleta tenta de novo.",
  endereco_bloqueado: "O endereço aponta para uma rede interna e foi bloqueado.",
  pagina_lenta: "A página demorou demais para responder.",
  pagina_grande: "A página é grande demais (mais de 2 MB).",
  pagina_inacessivel: "Não foi possível abrir a página.",
  inesperado: "Erro inesperado. A próxima coleta tenta de novo.",
} as const;
export type CategoriaErro = keyof typeof TEXTO_ERRO;

const POR_MENSAGEM: Record<string, CategoriaErro> = {
  "Endereço não permitido": "endereco_bloqueado",
  "A página demorou demais": "pagina_lenta",
  "Página grande demais": "pagina_grande",
  "Não foi possível abrir a página": "pagina_inacessivel",
};

export function categorizarErro(erro: unknown): CategoriaErro {
  if (erro instanceof ErroMeta) {
    if (erro.codigo === 110) return "perfil_nao_profissional";
    if (erro.codigo === 190 || erro.codigo === 10 || erro.codigo === 200) return "chave_meta";
    return "meta";
  }
  if (erro instanceof ErroNegocio) return POR_MENSAGEM[erro.message] ?? "inesperado";
  return "inesperado";
}

/** Texto da categoria; tipos antigos ou desconhecidos caem em "inesperado". */
export const textoDoErro = (tipo: string) => TEXTO_ERRO[tipo as CategoriaErro] ?? TEXTO_ERRO.inesperado;

const ROTULO_PASSO: Record<string, string> = { instagram: "Instagram", paginas: "Páginas", transcricoes: "Transcrição", resumos: "Resumos", sinais: "Sinais" };

/** Mensagens (sem repetir) dos erros de um concorrente gravados numa coleta. */
export function errosDoConcorrente(erros: unknown, concorrenteId: string): string[] {
  if (!Array.isArray(erros)) return [];
  const textos = erros
    .filter((e): e is { concorrenteId: string; passo: string; tipo: string } => typeof e === "object" && e !== null && (e as { concorrenteId?: unknown }).concorrenteId === concorrenteId)
    .map((e) => `${ROTULO_PASSO[e.passo] ?? e.passo}: ${textoDoErro(e.tipo)}`);
  return [...new Set(textos)];
}
