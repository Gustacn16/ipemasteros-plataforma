// Montagem pura do pedido de avaliação diária de uma conversa para a API de lotes da Anthropic.
import { z } from "zod";
import type { ModeloIa } from "@/lib/ia/precos";
import { CRITERIOS, type TipoAvaliacao } from "../regras/avaliacao";
import { ROTULO_TIPO } from "./resumo-grupo";

export const MODELO_AVALIACAO: ModeloIa = "claude-sonnet-5-5";
export const MAX_TOKENS_AVALIACAO = 16_000;
export const LIMITE_ENTRADA_AVALIACAO = 60_000;
const AVISO_CORTE = "(Mensagens mais antigas foram omitidas.)";
const DESLOCAMENTO_SP_MS = 3 * 3_600_000;

/** Sem nome nem telefone: só o papel de quem falou. */
export type MensagemParaAvaliacao = { enviadaEm: Date; deMim: boolean; tipo: string; texto: string | null };

export type TemposParaAvaliacao = { primeiraRespostaMin: number | null; respostaMin: number | null; noSla: string | null };

function emSaoPaulo(data: Date): string {
  const iso = new Date(data.getTime() - DESLOCAMENTO_SP_MS).toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
}

function linhaDaMensagem(m: MensagemParaAvaliacao): string {
  const conteudo = m.texto?.trim() || ROTULO_TIPO[m.tipo] || "[mensagem]";
  return `[${emSaoPaulo(m.enviadaEm)}] ${m.deMim ? "Atendente" : "Cliente"}: ${conteudo}`;
}

function blocoTempos(t: TemposParaAvaliacao): string {
  const min = (v: number | null) => (v === null ? "sem dado" : `${v} min`);
  return [
    "Tempos medidos pelo sistema (só para comentar):",
    `- Primeira resposta: ${min(t.primeiraRespostaMin)}`,
    `- Tempo de resposta: ${min(t.respostaMin)}`,
    `- Respostas dentro do prazo: ${t.noSla ?? "sem dado"}`,
  ].join("\n");
}

export function montarEntradaAvaliacao(
  mensagens: MensagemParaAvaliacao[],
  ontem: { inicio: Date; fim: Date },
  tempos: TemposParaAvaliacao,
): { texto: string; cortada: boolean } {
  const ordenadas = [...mensagens].sort((a, b) => a.enviadaEm.getTime() - b.enviadaEm.getTime());
  const itens = ordenadas.map((m) => ({
    linha: linhaDaMensagem(m),
    deOntem: m.enviadaEm >= ontem.inicio && m.enviadaEm <= ontem.fim,
  }));
  const marcador = `--- Ontem (${emSaoPaulo(ontem.inicio).slice(0, 5)}) ---`;
  const cabecalho = blocoTempos(tempos);

  // O marcador fica separado: vai logo antes da primeira mensagem de ontem que ficou no corpo.
  const montar = (mantidas: typeof itens, cortada: boolean) => {
    const corpo: string[] = [];
    let marcou = false;
    for (const i of mantidas) {
      if (i.deOntem && !marcou) {
        corpo.push(marcador);
        marcou = true;
      }
      corpo.push(i.linha);
    }
    return [cabecalho, "", ...(cortada ? [AVISO_CORTE] : []), ...corpo].join("\n");
  };

  const completo = montar(itens, false);
  if (completo.length <= LIMITE_ENTRADA_AVALIACAO) return { texto: completo, cortada: false };

  // Mantém as mais recentes: descarta as mais antigas até caber (com o aviso e o marcador).
  let total = montar([], true).length;
  let temOntem = false;
  let inicio = itens.length;
  const ultima = itens[itens.length - 1];
  for (let i = itens.length - 1; i >= 0; i--) {
    const extra = itens[i].deOntem && !temOntem ? marcador.length + 1 : 0;
    if (total + itens[i].linha.length + 1 + extra > LIMITE_ENTRADA_AVALIACAO) break;
    total += itens[i].linha.length + 1 + extra;
    if (itens[i].deOntem) temOntem = true;
    inicio = i;
  }
  const mantidas = itens.slice(inicio);
  if (mantidas.length === 0 && ultima) {
    // Uma só mensagem maior que o limite: encurta o texto dela em vez de deixar o corpo vazio.
    const folga = LIMITE_ENTRADA_AVALIACAO - total - (ultima.deOntem ? marcador.length + 1 : 0) - 2;
    mantidas.push({ ...ultima, linha: ultima.linha.slice(0, Math.max(0, folga)) + "…" });
  }
  return { texto: montar(mantidas, true), cortada: true };
}

// ─── Esquemas ────────────────────────────────────────────────────────────────

const CRITERIO_JSON = {
  type: "object",
  properties: { seAplica: { type: "boolean" }, nota: { type: "integer" }, frase: { type: "string" } },
  required: ["seAplica", "nota", "frase"],
  additionalProperties: false,
} as const;

function criteriosJson(tipo: TipoAvaliacao) {
  const chaves = CRITERIOS[tipo].map((c) => c.chave);
  return {
    type: "object",
    properties: Object.fromEntries(chaves.map((k) => [k, CRITERIO_JSON])),
    required: chaves,
    additionalProperties: false,
  } as const;
}

const LISTA_TEXTO = { type: "array", items: { type: "string" } } as const;

export const SITUACOES = ["novo", "qualificando", "interessado", "objecao", "negociando", "sem_retorno", "fechou", "perdido"] as const;
export const TEMPERATURAS = ["quente", "morno", "frio"] as const;

export const ESQUEMA_AVALIACAO_VENDAS = {
  type: "object",
  properties: {
    situacao: { type: "string", enum: [...SITUACOES] },
    temperatura: { type: "string", enum: [...TEMPERATURAS] },
    motivoTemperatura: { type: "string" },
    oQueRespondeu: { type: "string" },
    proximoPasso: { type: "string" },
    criterios: criteriosJson("vendas"),
    pontosFortes: LISTA_TEXTO,
    melhorar: LISTA_TEXTO,
  },
  required: ["situacao", "temperatura", "motivoTemperatura", "oQueRespondeu", "proximoPasso", "criterios", "pontosFortes", "melhorar"],
  additionalProperties: false,
} as const satisfies Record<string, unknown>;

export const ESQUEMA_AVALIACAO_CS = {
  type: "object",
  properties: {
    oQueRespondeu: { type: "string" },
    proximoPasso: { type: "string" },
    criterios: criteriosJson("cs"),
    pontosFortes: LISTA_TEXTO,
    melhorar: LISTA_TEXTO,
  },
  required: ["oQueRespondeu", "proximoPasso", "criterios", "pontosFortes", "melhorar"],
  additionalProperties: false,
} as const satisfies Record<string, unknown>;

// Os limites não vão no JSON Schema (a API não os aceita); aqui o valor é aparado em vez de reprovar uma boa avaliação.
const esquemaCriterio = z
  .object({ seAplica: z.boolean(), nota: z.number(), frase: z.string() })
  .transform((c) => ({
    nota: c.seAplica ? Math.min(10, Math.max(0, Math.round(c.nota))) : null,
    frase: c.frase.trim(),
  }));

function criteriosZod(tipo: TipoAvaliacao) {
  return z.object(Object.fromEntries(CRITERIOS[tipo].map((c) => [c.chave, esquemaCriterio])));
}

const lista = z.array(z.string()).transform((l) => l.slice(0, 5));

export const esquemaZodAvaliacaoVendas = z.object({
  situacao: z.enum(SITUACOES),
  temperatura: z.enum(TEMPERATURAS),
  motivoTemperatura: z.string(),
  oQueRespondeu: z.string(),
  proximoPasso: z.string(),
  criterios: criteriosZod("vendas") as z.ZodType<Record<string, { nota: number | null; frase: string }>, Record<string, unknown>>,
  pontosFortes: lista,
  melhorar: lista,
});

export const esquemaZodAvaliacaoCs = z.object({
  oQueRespondeu: z.string(),
  proximoPasso: z.string(),
  criterios: criteriosZod("cs") as z.ZodType<Record<string, { nota: number | null; frase: string }>, Record<string, unknown>>,
  pontosFortes: lista,
  melhorar: lista,
});

export type AvaliacaoVendas = z.infer<typeof esquemaZodAvaliacaoVendas>;
export type AvaliacaoCs = z.infer<typeof esquemaZodAvaliacaoCs>;

// ─── Instruções ──────────────────────────────────────────────────────────────

const CONTEXTO = `Você avalia o atendimento de uma conversa de WhatsApp de uma escola, o IPEMaster, para a gestão. Você recebe as mensagens em ordem, uma por linha, no formato "[dd/mm hh:mm] Cliente: texto" ou "[dd/mm hh:mm] Atendente: texto". O Atendente é a equipe da escola. Mídia sem texto aparece como [áudio], [imagem] e assim por diante. No topo vêm os tempos medidos pelo sistema, só para você comentar.`;

const REGRAS_COMUNS = `Regras:
- Avalie com foco em ontem (as mensagens depois da linha "--- Ontem (dd/mm) ---"), usando os dias anteriores apenas como contexto.
- Não avalie tempo de resposta: o sistema mede. Você pode comentá-lo em uma frase, usando os tempos recebidos.
- Nunca invente o que não está nas mensagens.
- Se o critério não se aplica a esta conversa, devolva seAplica: false (a nota é ignorada nesse caso). Se ontem o cliente não escreveu ou o atendente não teve o que fazer, é o caso.
- Para cada critério dê uma nota inteira de 0 a 10 e uma frase curta que a justifique.
- Não inclua telefones nem nomes: refira-se a "o cliente" e "o atendente".
- Responda apenas com o JSON pedido, em português do Brasil.`;

const CAMPOS_COMUNS = `- "oQueRespondeu": em 1 ou 2 frases, o que o atendente respondeu ontem.
- "proximoPasso": a próxima ação que a equipe deve tomar com esta conversa.
- "pontosFortes": até 5 pontos em que o atendente foi bem (pode ficar vazio).
- "melhorar": até 5 pontos concretos a melhorar (pode ficar vazio).`;

export const INSTRUCOES_AVALIACAO: Record<TipoAvaliacao, string> = {
  vendas: `${CONTEXTO}

Esta é uma conversa de VENDAS. Os clientes são leads: no time "paciente modelo" são leads de campanhas que agendam atendimento como paciente modelo; no time "comercial" são leads interessados nos cursos da escola.

Critérios (cada um de 0 a 10):
- "qualificacao": 0 = não perguntou nada para entender o lead; 10 = descobriu objetivo, momento e perfil do lead antes de oferecer.
- "quebra_objecao": 0 = ignorou ou piorou a objeção (preço, tempo, dúvida); 10 = acolheu a objeção e a contornou com argumentos claros.
- "followup": 0 = deixou o lead sem retorno quando devia cobrar; 10 = retomou o contato no momento certo e sem insistir demais.
- "clareza_cordialidade": 0 = confuso, seco ou mal-educado; 10 = claro, educado e próximo.
- "conducao_fechamento": 0 = não levou a conversa a lugar nenhum; 10 = conduziu com firmeza para agendar, matricular ou o próximo passo concreto.

${REGRAS_COMUNS}

Campos do JSON:
- "situacao": um entre novo, qualificando, interessado, objecao, negociando, sem_retorno, fechou, perdido.
- "temperatura": quente, morno ou frio, conforme a chance de fechar.
- "motivoTemperatura": uma frase com o motivo da temperatura.
${CAMPOS_COMUNS}
- "criterios": um objeto com os 5 critérios acima, cada um com seAplica, nota e frase.`,

  cs: `${CONTEXTO}

Esta é uma conversa de CS (sucesso do cliente), o pós-venda: os clientes são alunos e ex-compradores que pedem ajuda, tiram dúvidas ou reclamam.

Critérios (cada um de 0 a 10):
- "cordialidade": 0 = seco, impaciente ou mal-educado; 10 = acolhedor e respeitoso.
- "clareza": 0 = resposta confusa ou incompleta; 10 = resposta clara e fácil de seguir.
- "resolveu_duvida": 0 = a dúvida ou o problema ficou sem solução; 10 = resolveu por completo ou encaminhou com prazo.
- "conduziu_proximo_passo": 0 = terminou sem dizer o que acontece depois; 10 = deixou o próximo passo claro e quem o dará.

${REGRAS_COMUNS}

Campos do JSON:
${CAMPOS_COMUNS}
- "criterios": um objeto com os 4 critérios acima, cada um com seAplica, nota e frase.`,
};

export type PedidoAvaliacao = {
  custom_id: string;
  params: {
    model: ModeloIa;
    max_tokens: number;
    system: string;
    messages: { role: "user"; content: string }[];
    output_config: {
      effort: "medium";
      format: { type: "json_schema"; schema: typeof ESQUEMA_AVALIACAO_VENDAS | typeof ESQUEMA_AVALIACAO_CS };
    };
  };
};

export function pedidoAvaliacao(customId: string, tipo: TipoAvaliacao, entrada: string): PedidoAvaliacao {
  return {
    custom_id: customId,
    params: {
      model: MODELO_AVALIACAO,
      max_tokens: MAX_TOKENS_AVALIACAO,
      system: INSTRUCOES_AVALIACAO[tipo],
      messages: [{ role: "user", content: entrada }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: tipo === "vendas" ? ESQUEMA_AVALIACAO_VENDAS : ESQUEMA_AVALIACAO_CS },
      },
    },
  };
}
