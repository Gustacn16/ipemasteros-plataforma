import { z } from "zod";
import { datasValidas } from "../regras/prazo";

export const PRIORIDADES = ["urgente", "alta", "normal", "baixa"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

const id = z.string().min(1);
const titulo = z.string().trim().min(1, "Informe o título").max(200, "Título longo demais");

/** "AAAA-MM-DD" do <input type="date"> vira meia-noite UTC (coluna @db.Date). Vazio vira null. */
const data = z
  .union([z.literal(""), z.iso.date("Data inválida")])
  .nullish()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

export const esquemaNovaTarefa = z.object({
  listaId: id,
  titulo,
  tarefaPaiId: id.optional(),
});

export const esquemaAtualizarTarefa = z
  .object({
    tarefaId: id,
    titulo,
    descricao: z
      .string()
      .max(20_000, "Descrição longa demais")
      .transform((d) => d.trim() || null),
    prioridade: z.enum(PRIORIDADES),
    dataInicio: data,
    dataEntrega: data,
    responsaveis: z.array(id).max(20, "Responsáveis demais"),
  })
  .refine((d) => datasValidas(d.dataInicio, d.dataEntrega), {
    message: "O início não pode ser depois da entrega",
    path: ["dataInicio"],
  });

export const esquemaMudarStatus = z.object({
  tarefaId: id,
  statusId: id,
  confirmarSubtarefasAbertas: z.boolean().optional(),
});

export const esquemaFiltrosLista = z.object({
  responsavel: z.string().optional(),
  prioridade: z.enum(PRIORIDADES).optional().catch(undefined),
  etiqueta: z.string().optional(),
  atrasadas: z
    .string()
    .optional()
    .transform((v) => v === "1"),
});
export type FiltrosLista = z.infer<typeof esquemaFiltrosLista>;

const textoItem = z.string().trim().min(1, "Escreva o item").max(200, "Item longo demais");

export const esquemaNovoItemChecklist = z.object({ tarefaId: id, texto: textoItem });

export const esquemaAtualizarItemChecklist = z
  .object({ itemId: id, texto: textoItem.optional(), concluido: z.boolean().optional() })
  .refine((d) => d.texto !== undefined || d.concluido !== undefined, "Nada para salvar");

export const esquemaMoverItemChecklist = z.object({ itemId: id, direcao: z.enum(["cima", "baixo"]) });

export const esquemaEtiquetasTarefa = z.object({ tarefaId: id, etiquetaIds: z.array(id).max(20, "Etiquetas demais") });

const nomeEtiqueta = z.string().trim().min(1, "Informe o nome").max(40, "Nome longo demais");
const corEtiqueta = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").transform((c) => c.toLowerCase());

export const esquemaNovaEtiqueta = z.object({ espacoId: id, nome: nomeEtiqueta, cor: corEtiqueta });
export const esquemaEditarEtiqueta = z.object({ etiquetaId: id, nome: nomeEtiqueta, cor: corEtiqueta });
