import { z } from "zod";
import { esquemaEvento } from "@/modulos/agenda/esquemas/agenda";
import { esquemaVenda } from "@/modulos/comercial/esquemas/venda";
import { esquemaNovoConteudo } from "@/modulos/conteudo/esquemas/conteudo";
import { esquemaMudarStatus, esquemaNovaTarefa, esquemaNovoItemChecklist } from "@/modulos/tarefas/esquemas/tarefa";

// Dados de cada tipo de proposta do Nexu. Validados ao criar a proposta e de novo ao confirmar.
// A proposta guarda a ENTRADA validada (JSON puro); a saída (com Date, números etc.) só existe ao confirmar.

const id = z.string().min(1);
const titulo = esquemaNovaTarefa.shape.titulo;

/** "AAAA-MM-DD" que existe no calendário. */
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida. Use AAAA-MM-DD.")
  .refine((d) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
  }, "Data inválida. Use AAAA-MM-DD.");

/** Campo que o Nexu não preenche: qualquer valor enviado é descartado. */
const ignorado = z
  .string()
  .optional()
  .transform((): null => null);

export const esquemaPropostaCriarTarefa = z.object({
  tipo: z.literal("criar_tarefa"),
  listaId: id,
  titulo,
  descricao: z.string().trim().max(20_000, "Descrição longa demais").optional(),
  dataEntrega: dia.optional(),
  responsaveis: z.array(id).max(20, "Responsáveis demais").optional(),
  subtarefas: z.array(titulo).max(50, "No máximo 50 subtarefas de uma vez").optional(),
});

export const esquemaPropostaMudarStatus = z.object({
  tipo: z.literal("mudar_status_tarefa"),
  tarefaId: esquemaMudarStatus.shape.tarefaId,
  statusId: esquemaMudarStatus.shape.statusId,
});

export const esquemaPropostaChecklist = esquemaNovoItemChecklist.extend({ tipo: z.literal("adicionar_checklist") });

export const esquemaPropostaEvento = esquemaEvento.safeExtend({ tipo: z.literal("criar_evento") });

export const esquemaPropostaPost = esquemaNovoConteudo
  .pick({ titulo: true, formatoId: true, canalIds: true, dataPublicacao: true })
  .extend({
    tipo: z.literal("criar_post"),
    legenda: z.string().trim().min(1, "Escreva a legenda").max(10_000, "Legenda longa demais"),
  });

export const esquemaPropostaVenda = esquemaVenda.safeExtend({
  tipo: z.literal("registrar_venda"),
  whatsappCliente: ignorado,
  observacoes: ignorado,
  proximosPassos: ignorado,
});

export const esquemaProposta = z.discriminatedUnion("tipo", [
  esquemaPropostaCriarTarefa,
  esquemaPropostaMudarStatus,
  esquemaPropostaChecklist,
  esquemaPropostaEvento,
  esquemaPropostaPost,
  esquemaPropostaVenda,
]);

/** O que a ferramenta entrega para virar proposta (e o que fica gravado em `dados`). */
export type EntradaProposta = z.input<typeof esquemaProposta>;
/** Os dados prontos para o serviço do módulo. */
export type DadosProposta = z.output<typeof esquemaProposta>;

/** Campos que nunca são gravados na proposta, mesmo se vierem na entrada. */
export const CAMPOS_IGNORADOS = ["whatsappCliente", "observacoes", "proximosPassos"] as const;
