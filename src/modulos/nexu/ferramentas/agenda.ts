import { z } from "zod";
import { ErroNegocio } from "@/lib/erros";
import { listarEventos } from "@/modulos/agenda/servicos/eventos";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";

export const MAX_DIAS_AGENDA = 62;
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

const entrada = z.object({
  de: z.string().describe("primeiro dia, no formato AAAA-MM-DD"),
  ate: z.string().describe(`último dia, no formato AAAA-MM-DD (período de no máximo ${MAX_DIAS_AGENDA} dias)`),
  turma: z.string().optional().describe("restringe a uma turma"),
});

/** Dias do período contando os dois extremos. */
function diasDoPeriodo(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1;
}

export const ferramentaVerAgenda: FerramentaNexu<typeof entrada> = {
  nome: "ver_agenda",
  descricao: "Lista os eventos institucionais (aulas, provas, lives, feriados) de um período, conforme o que a pessoa pode ver.",
  entrada,
  permissao: "agenda:ver_institucional",
  rotulo: "Consultando a agenda…",
  tipo: "consulta",
  async executar(ator, { de, ate, turma }) {
    if (!FORMATO_DIA.test(de) || !FORMATO_DIA.test(ate) || Number.isNaN(Date.parse(de)) || Number.isNaN(Date.parse(ate))) {
      throw new ErroNegocio("Datas inválidas. Use AAAA-MM-DD.");
    }
    const dias = diasDoPeriodo(de, ate);
    if (dias < 1) throw new ErroNegocio("O primeiro dia não pode ser depois do último.");
    if (dias > MAX_DIAS_AGENDA) throw new ErroNegocio(`Período grande demais. Consulte no máximo ${MAX_DIAS_AGENDA} dias por vez.`);
    const eventos = await listarEventos(ator, { de, ate, turma });
    return limitarLista(
      eventos.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        tipo: e.tipo.nome,
        turma: e.turma,
        local: e.local,
        dataInicio: e.dataInicio,
        dataFim: e.dataFim,
        horaInicio: e.horaInicio,
        horaFim: e.horaFim,
      })),
    );
  },
};
