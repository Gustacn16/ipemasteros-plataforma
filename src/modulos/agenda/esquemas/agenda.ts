import { z } from "zod";
import { MAX_LOTE, validarPeriodo, type Periodo } from "../regras/periodo";

const id = z.string().min(1);

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Data inválida");

const hora = z.string().nullable();

const camposPeriodo = {
  dataInicio: dia,
  dataFim: dia,
  horaInicio: hora,
  horaFim: hora,
};

/** Mapeia a mensagem de validarPeriodo para o campo certo. */
function campoDoErro(msg: string): "dataFim" | "horaFim" {
  return msg.startsWith("A data final") || msg.startsWith("Um evento dura") ? "dataFim" : "horaFim";
}

function checarPeriodo(p: Periodo, ctx: z.RefinementCtx, prefixo: (string | number)[] = []) {
  const erro = validarPeriodo(p);
  if (erro) ctx.addIssue({ code: "custom", message: erro, path: [...prefixo, campoDoErro(erro)] });
}

export const esquemaPeriodo = z.object(camposPeriodo).superRefine((p, ctx) => checarPeriodo(p, ctx));

const camposEvento = {
  tipoId: id,
  titulo: z.string().trim().min(1, "Informe o título").max(150, "Título longo demais"),
  turma: z.string().trim().max(100, "Turma longa demais").optional(),
  local: z.string().trim().max(150, "Local longo demais").optional(),
  descricao: z.string().trim().max(5000, "Descrição longa demais").optional(),
  visivelProfessores: z.boolean(),
};

export const esquemaEvento = z.object({ ...camposEvento, ...camposPeriodo }).superRefine((e, ctx) => checarPeriodo(e, ctx));
export type DadosEvento = z.infer<typeof esquemaEvento>;

export const esquemaEditarEvento = z
  .object({ ...camposEvento, ...camposPeriodo, eventoId: id })
  .superRefine((e, ctx) => checarPeriodo(e, ctx));

export const esquemaLote = z
  .object({
    ...camposEvento,
    horaInicio: hora,
    horaFim: hora,
    numerar: z.boolean(),
    periodos: z
      .array(z.object({ dataInicio: dia, dataFim: dia }))
      .min(1, "Informe ao menos um período")
      .max(MAX_LOTE, `No máximo ${MAX_LOTE} períodos`),
  })
  .superRefine((l, ctx) => {
    const vistos = new Set<string>();
    l.periodos.forEach((p, i) => {
      if (vistos.has(p.dataInicio)) {
        ctx.addIssue({ code: "custom", message: "Esta data já está no lote.", path: ["periodos", i] });
        return;
      }
      vistos.add(p.dataInicio);
      const erro = validarPeriodo({ ...p, horaInicio: l.horaInicio, horaFim: l.horaFim });
      if (erro) ctx.addIssue({ code: "custom", message: erro, path: ["periodos", i] });
    });
  });
export type DadosLote = z.infer<typeof esquemaLote>;

export const esquemaTipo = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(40, "Nome longo demais"),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
});

// ─── Filtro salvo em cookie ─────────────────────────────────────────────────

export const COOKIE_FILTRO = "agenda_filtro";

const esquemaFiltroAgenda = z.object({
  visao: z.enum(["mes", "semana", "lista"]).optional().catch(undefined),
  tipos: z.array(z.string()).catch([]),
  turma: z.string().optional().catch(undefined),
  tarefas: z.boolean().catch(true),
  desligadas: z.array(z.string()).catch([]),
});
export type FiltroAgenda = {
  visao?: "mes" | "semana" | "lista";
  tipos: string[];
  turma?: string;
  tarefas: boolean;
  desligadas: string[];
};

export function filtroDoCookie(valor?: string): FiltroAgenda {
  const padrao: FiltroAgenda = { tipos: [], tarefas: true, desligadas: [] };
  if (!valor) return padrao;
  try {
    const r = esquemaFiltroAgenda.safeParse(JSON.parse(valor));
    if (!r.success) return padrao;
    const { visao, turma, ...resto } = r.data;
    return { ...resto, ...(visao ? { visao } : {}), ...(turma ? { turma } : {}) };
  } catch {
    return padrao;
  }
}
