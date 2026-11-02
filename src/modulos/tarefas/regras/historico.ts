// Histórico de alterações da tarefa (regra 8). Os valores são gravados já prontos
// para exibir (nomes e dias), para o histórico não mudar se algo for renomeado depois.
import { ROTULO_PRIORIDADE, type Prioridade } from "../esquemas/tarefa";

export type CampoHistorico = "status" | "responsaveis" | "dataInicio" | "dataEntrega" | "prioridade" | "lista";

/** Valor gravado: nome (status, lista), código (prioridade), dia "AAAA-MM-DD" ou lista de nomes. */
export type ValorHistorico = string | string[] | null;

export type Mudanca = { campo: CampoHistorico; valorAntes: ValorHistorico; valorDepois: ValorHistorico };

type Retrato = {
  prioridade: Prioridade;
  dataInicio: string | null;
  dataEntrega: string | null;
  responsaveis: string[];
};

const ordenados = (nomes: string[]) => [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Compara a tarefa antes e depois de salvar e devolve só o que mudou. */
export function mudancasDaTarefa(antes: Retrato, depois: Retrato): Mudanca[] {
  const mudancas: Mudanca[] = [];
  if (antes.prioridade !== depois.prioridade) {
    mudancas.push({ campo: "prioridade", valorAntes: antes.prioridade, valorDepois: depois.prioridade });
  }
  for (const campo of ["dataInicio", "dataEntrega"] as const) {
    if (antes[campo] !== depois[campo]) mudancas.push({ campo, valorAntes: antes[campo], valorDepois: depois[campo] });
  }
  const [a, d] = [ordenados(antes.responsaveis), ordenados(depois.responsaveis)];
  if (a.join("\u0000") !== d.join("\u0000")) mudancas.push({ campo: "responsaveis", valorAntes: a, valorDepois: d });
  return mudancas;
}

const dia = (v: ValorHistorico) => (typeof v === "string" ? v.split("-").reverse().join("/") : "sem data");
const pessoas = (v: ValorHistorico) => (Array.isArray(v) && v.length ? v.join(", ") : "ninguém");
const texto = (v: ValorHistorico) => (typeof v === "string" ? v : "—");
const prioridade = (v: ValorHistorico) => (typeof v === "string" && v in ROTULO_PRIORIDADE ? ROTULO_PRIORIDADE[v as Prioridade] : texto(v));

/** Frase curta para a linha do histórico ("mudou a entrega de 27/11/2026 para 30/11/2026"). */
export function descreverMudanca({ campo, valorAntes, valorDepois }: Mudanca): string {
  switch (campo) {
    case "status":
      return `moveu de ${texto(valorAntes)} para ${texto(valorDepois)}`;
    case "lista":
      return `mudou da lista ${texto(valorAntes)} para ${texto(valorDepois)}`;
    case "prioridade":
      return `mudou a prioridade de ${prioridade(valorAntes)} para ${prioridade(valorDepois)}`;
    case "dataInicio":
      return `mudou o início de ${dia(valorAntes)} para ${dia(valorDepois)}`;
    case "dataEntrega":
      return `mudou a entrega de ${dia(valorAntes)} para ${dia(valorDepois)}`;
    case "responsaveis":
      return `mudou os responsáveis de ${pessoas(valorAntes)} para ${pessoas(valorDepois)}`;
  }
}
