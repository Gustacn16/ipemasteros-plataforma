// Montagem pura do pedido de resumo diário de grupo para a API de lotes da Anthropic.
import { z } from "zod";
import type { ModeloIa } from "@/lib/ia/precos";

export type MensagemParaResumo = {
  enviadaEm: Date;
  autor: string;
  equipe: boolean;
  tipo: string;
  texto: string | null;
};

export const LIMITE_ENTRADA_RESUMO = 120_000;
const AVISO_CORTE = "(Mensagens mais antigas do dia foram omitidas.)";
const DESLOCAMENTO_SP_MS = 3 * 3_600_000;

const ROTULO_TIPO: Record<string, string> = {
  imagem: "[imagem]",
  audio: "[áudio]",
  video: "[vídeo]",
  documento: "[documento]",
  figurinha: "[figurinha]",
  outro: "[mensagem]",
};

function horaSaoPaulo(data: Date): string {
  return new Date(data.getTime() - DESLOCAMENTO_SP_MS).toISOString().slice(11, 16);
}

function linhaDaMensagem(m: MensagemParaResumo): string {
  const conteudo = m.texto?.trim() || ROTULO_TIPO[m.tipo] || "[mensagem]";
  const autor = m.equipe ? `${m.autor} (equipe)` : m.autor;
  return `[${horaSaoPaulo(m.enviadaEm)}] ${autor}: ${conteudo}`;
}

export function montarEntradaResumo(
  grupo: { nome: string | null; turma: string | null },
  mensagens: MensagemParaResumo[],
): { texto: string; cortada: boolean } {
  const cabecalho = [`Grupo: ${grupo.nome ?? "(sem nome)"}`, ...(grupo.turma ? [`Turma: ${grupo.turma}`] : [])].join("\n");
  const linhas = [...mensagens].sort((a, b) => a.enviadaEm.getTime() - b.enviadaEm.getTime()).map(linhaDaMensagem);

  const montar = (corpo: string[], cortada: boolean) =>
    [cabecalho, ...(cortada ? [AVISO_CORTE] : []), "", ...corpo].join("\n");

  let texto = montar(linhas, false);
  if (texto.length <= LIMITE_ENTRADA_RESUMO) return { texto, cortada: false };

  // Mantém as mais recentes: descarta as mais antigas até caber (com o aviso).
  let inicio = 0;
  let total = montar([], true).length;
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (total + linhas[i].length + 1 > LIMITE_ENTRADA_RESUMO) {
      inicio = i + 1;
      break;
    }
    total += linhas[i].length + 1;
  }
  texto = montar(linhas.slice(inicio), true);
  return { texto, cortada: true };
}

export function participacaoDoDia(mensagens: MensagemParaResumo[]): { autor: string; mensagens: number }[] {
  const contagem = new Map<string, number>();
  for (const m of mensagens) {
    if (m.equipe) continue;
    contagem.set(m.autor, (contagem.get(m.autor) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([autor, mensagens]) => ({ autor, mensagens }))
    .sort((a, b) => b.mensagens - a.mensagens || a.autor.localeCompare(b.autor, "pt-BR"));
}

export const ESQUEMA_RESUMO = {
  type: "object",
  properties: {
    resumo: { type: "string" },
    temas: { type: "array", items: { type: "string" }, maxItems: 6 },
    pendencias: {
      type: "array",
      maxItems: 15,
      items: {
        type: "object",
        properties: {
          autor: { type: "string" },
          hora: { type: "string", pattern: "^[0-2][0-9]:[0-5][0-9]$" },
          texto: { type: "string" },
        },
        required: ["autor", "hora", "texto"],
        additionalProperties: false,
      },
    },
    destaques: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
  required: ["resumo", "temas", "pendencias", "destaques"],
  additionalProperties: false,
} as const;

export const esquemaZodResumo = z.object({
  resumo: z.string(),
  temas: z.array(z.string()).max(6),
  pendencias: z
    .array(z.object({ autor: z.string(), hora: z.string().regex(/^[0-2]\d:[0-5]\d$/), texto: z.string() }))
    .max(15),
  destaques: z.array(z.string()).max(5),
});

export type ResumoGrupo = z.infer<typeof esquemaZodResumo>;

export const INSTRUCOES_RESUMO = `Você resume o dia de um grupo de WhatsApp de uma escola (o IPEMaster) para a equipe.
Você recebe as mensagens do dia em ordem, uma por linha, no formato "[hh:mm] Autor: texto". Autores marcados com "(equipe)" são da escola; os demais são alunos. Mídia sem texto aparece como [áudio], [imagem] e assim por diante.

Responda apenas com o JSON pedido, em português do Brasil:
- "resumo": o que aconteceu no dia, em até 5 frases.
- "temas": os principais assuntos conversados (até 6), em poucas palavras cada.
- "pendencias": dúvidas e reclamações de alunos que a equipe NÃO respondeu até o fim do dia (até 15). Para cada uma, informe o autor, a hora (hh:mm) da mensagem e o texto resumido. Se a equipe respondeu, não inclua.
- "destaques": fatos que merecem atenção da equipe, como elogios, riscos de evasão ou problemas repetidos (até 5). Pode ficar vazio.

Nunca invente o que não está nas mensagens. Se não houver o que listar, devolva a lista vazia. Não inclua telefones nem identificadores.`;

export type PedidoResumo = {
  custom_id: string;
  params: {
    model: ModeloIa;
    max_tokens: number;
    system: string;
    messages: { role: "user"; content: string }[];
    output_config: { effort: "medium"; format: { type: "json_schema"; schema: typeof ESQUEMA_RESUMO } };
  };
};

export function pedidoResumo(customId: string, modelo: ModeloIa, entrada: string): PedidoResumo {
  return {
    custom_id: customId,
    params: {
      model: modelo,
      max_tokens: 8000,
      system: INSTRUCOES_RESUMO,
      messages: [{ role: "user", content: entrada }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_RESUMO } },
    },
  };
}
