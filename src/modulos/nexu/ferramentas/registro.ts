import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { temPermissao, type Papel } from "@/lib/permissoes";
import { ferramentaBuscarAluno, ferramentaTurmasEFormaturas } from "./academico";
import {
  ferramentaProporAdicionarChecklist,
  ferramentaProporCriarEvento,
  ferramentaProporCriarPost,
  ferramentaProporCriarTarefa,
  ferramentaProporMudarStatusTarefa,
  ferramentaProporRegistrarVenda,
} from "./acoes";
import { ferramentaVerAgenda } from "./agenda";
import { ferramentaProdutos, ferramentaVendasEMetas } from "./comercial";
import { ferramentaCalendarioConteudo, ferramentaMetricasInstagram } from "./conteudo";
import { ferramentaBuscarPessoas } from "./pessoas";
import { ferramentaBuscarTarefas, ferramentaRelatorioTarefasEquipe } from "./tarefas";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";

// Ordem fixa: a lista de ferramentas faz parte do prefixo do cache de prompt.
// biome-ignore lint: o tipo de cada entrada é apagado ao entrar na lista.
export const TODAS_FERRAMENTAS: FerramentaNexu[] = [
  ferramentaBuscarTarefas,
  ferramentaRelatorioTarefasEquipe,
  ferramentaVerAgenda,
  ferramentaTurmasEFormaturas,
  ferramentaBuscarAluno,
  ferramentaCalendarioConteudo,
  ferramentaMetricasInstagram,
  ferramentaVendasEMetas,
  ferramentaProdutos,
  ferramentaBuscarPessoas,
  // Ações (propostas) no fim, para não mexer no prefixo das consultas.
  ferramentaProporCriarTarefa,
  ferramentaProporMudarStatusTarefa,
  ferramentaProporAdicionarChecklist,
  ferramentaProporCriarEvento,
  ferramentaProporCriarPost,
  ferramentaProporRegistrarVenda,
] as unknown as FerramentaNexu[];

/** Ferramentas que o papel pode usar: precisa de `nexu:usar` e da permissão da própria ferramenta. */
export function ferramentasDoPapel(papel: Papel): FerramentaNexu[] {
  if (!temPermissao(papel, "nexu:usar")) return [];
  return TODAS_FERRAMENTAS.filter((f) => temPermissao(papel, f.permissao));
}

// Palavras de restrição que o strict tool use não aceita e que nem todo modelo respeita.
// O Zod continua validando cada uma delas no laço (rodarFerramenta), com erro legível.
const RESTRICOES_FORA_DO_SCHEMA = new Set([
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "pattern",
]);

function semRestricoes(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(semRestricoes);
  if (!no || typeof no !== "object") return no;
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(no as Record<string, unknown>)) {
    if (chave === "properties" && valor && typeof valor === "object") {
      // Aqui as chaves são nomes de campos (um campo pode se chamar "pattern").
      saida[chave] = Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([campo, sub]) => [campo, semRestricoes(sub)]),
      );
    } else if (!RESTRICOES_FORA_DO_SCHEMA.has(chave)) {
      saida[chave] = semRestricoes(valor);
    }
  }
  return saida;
}

/**
 * Sem `strict: true`: o modo estrito não aceita minLength/minimum etc. e limita a complexidade
 * do schema (400 na API). A entrada é validada pelo Zod em rodarFerramenta.
 */
export function paraFerramentaApi(f: FerramentaNexu): Anthropic.Tool {
  const esquema = semRestricoes(z.toJSONSchema(f.entrada)) as Record<string, unknown>;
  delete esquema.$schema;
  return {
    name: f.nome,
    description: f.descricao,
    input_schema: { ...esquema, type: "object", additionalProperties: false },
  };
}

export { limitarLista };
