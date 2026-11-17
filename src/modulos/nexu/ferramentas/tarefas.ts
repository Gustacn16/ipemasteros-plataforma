import { z } from "zod";
import { obterRelatorio } from "@/modulos/tarefas/servicos/relatorio";
import { buscarTarefasParaNexu } from "../servicos/consultas-tarefas";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";

const DIA = "no formato AAAA-MM-DD";

const entradaBuscarTarefas = z.object({
  escopo: z.enum(["minhas", "visiveis"]).describe("minhas = onde a pessoa é responsável; visiveis = tudo que ela pode ver"),
  atrasadas: z.boolean().optional().describe("só tarefas abertas com entrega anterior a hoje"),
  responsavelId: z.string().optional().describe("id do usuário responsável"),
  listaId: z.string().optional().describe("id da lista"),
  entregaDe: z.string().optional().describe(`entrega a partir deste dia, ${DIA}`),
  entregaAte: z.string().optional().describe(`entrega até este dia, ${DIA}`),
  incluirConcluidas: z.boolean().optional().describe("inclui tarefas concluídas (padrão: não)"),
});

export const ferramentaBuscarTarefas: FerramentaNexu<typeof entradaBuscarTarefas> = {
  nome: "buscar_tarefas",
  descricao:
    "Busca tarefas que a pessoa pode ver. Devolve id, título, lista, espaço, status, responsáveis, data de entrega e se está atrasada. Máximo de 50 por resposta, com o total.",
  entrada: entradaBuscarTarefas,
  permissao: "tarefas:usar",
  rotulo: "Consultando tarefas…",
  tipo: "consulta",
  async executar(ator, entrada) {
    return limitarLista(await buscarTarefasParaNexu(ator, entrada));
  },
};

const entradaRelatorio = z.object({
  periodo: z.enum(["semana", "mes", "mes_passado", "intervalo"]).describe("período do relatório"),
  de: z.string().optional().describe(`primeiro dia, só para periodo=intervalo, ${DIA}`),
  ate: z.string().optional().describe(`último dia, só para periodo=intervalo, ${DIA}`),
  espaco: z.string().optional().describe("id do espaço para restringir"),
});

export const ferramentaRelatorioTarefasEquipe: FerramentaNexu<typeof entradaRelatorio> = {
  nome: "relatorio_tarefas_equipe",
  descricao:
    "Relatório de tarefas por pessoa no período: abertas, atrasadas, entregues e percentual entregue no prazo. Só para quem vê a equipe.",
  entrada: entradaRelatorio,
  permissao: "tarefas:ver_relatorio_equipe",
  rotulo: "Consultando o relatório da equipe…",
  tipo: "consulta",
  async executar(ator, entrada) {
    const r = await obterRelatorio(ator, entrada);
    const pessoas = limitarLista(
      r.linhas.map((l) => ({
        pessoa: l.pessoa.nome,
        abertas: l.abertas,
        atrasadas: l.atrasadas,
        entregues: l.entregues,
        noPrazo: l.noPrazo,
        percentualNoPrazo: l.percentual,
      })),
    );
    return { periodo: { de: r.intervalo.primeiroDia, ate: r.intervalo.ultimoDia }, ...pessoas };
  },
};
