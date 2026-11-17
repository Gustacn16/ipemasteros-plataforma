import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { temPermissao, type Papel } from "@/lib/permissoes";
import { ferramentaBuscarAluno, ferramentaTurmasEFormaturas } from "./academico";
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
] as unknown as FerramentaNexu[];

/** Ferramentas que o papel pode usar: precisa de `nexu:usar` e da permissão da própria ferramenta. */
export function ferramentasDoPapel(papel: Papel): FerramentaNexu[] {
  if (!temPermissao(papel, "nexu:usar")) return [];
  return TODAS_FERRAMENTAS.filter((f) => temPermissao(papel, f.permissao));
}

export function paraFerramentaApi(f: FerramentaNexu): Anthropic.Tool {
  const esquema = { ...z.toJSONSchema(f.entrada) } as Record<string, unknown>;
  delete esquema.$schema;
  return {
    name: f.nome,
    description: f.descricao,
    input_schema: { ...esquema, type: "object", additionalProperties: false },
    strict: true,
  };
}

export { limitarLista };
