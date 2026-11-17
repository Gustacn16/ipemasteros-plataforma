import { z } from "zod";
import { FORMAS_PAGAMENTO } from "@/modulos/comercial/esquemas/produto";
import { criarProposta, PERMISSAO_DO_TIPO } from "../servicos/propostas";
import type { PropostaVisivel } from "../tipos";
import type { FerramentaNexu } from "./tipos";

// Ferramentas de ação: só gravam uma proposta pendente. Nada roda até a pessoa clicar em Confirmar.
// As entradas são JSON simples (sem transformações) para virar JSON Schema; a validação de verdade
// é o esquema da proposta, em criarProposta.

const DIA = "no formato AAAA-MM-DD";
const AVISO = "Não executa nada: cria uma proposta que a pessoa precisa confirmar na tela.";
const ROTULO = "Preparando a proposta…";

/** O loop (executar-pergunta) manda ao modelo só o id e a situação, e emite o evento `proposta` com isto. */
export type ResultadoProposta = { proposta: PropostaVisivel };

const entradaCriarTarefa = z.object({
  listaId: z
    .string()
    .describe("id da lista onde a tarefa será criada (buscar_tarefas devolve listaId; se não souber, um id inválido devolve as listas)"),
  titulo: z.string().describe("título da tarefa"),
  descricao: z.string().optional().describe("descrição"),
  dataEntrega: z.string().optional().describe(`prazo, ${DIA}`),
  responsaveis: z.array(z.string()).optional().describe("ids dos responsáveis (use buscar_pessoas); precisam ser membros do espaço"),
  subtarefas: z.array(z.string()).optional().describe("títulos de subtarefas a criar junto"),
});

export const ferramentaProporCriarTarefa: FerramentaNexu<typeof entradaCriarTarefa> = {
  nome: "propor_criar_tarefa",
  descricao: `Propõe criar uma tarefa (com responsáveis, prazo e subtarefas). ${AVISO}`,
  entrada: entradaCriarTarefa,
  permissao: PERMISSAO_DO_TIPO.criar_tarefa,
  rotulo: ROTULO,
  tipo: "proposta",
  async executar(ator, entrada, ctx): Promise<ResultadoProposta> {
    return { proposta: await criarProposta(ator, ctx, { tipo: "criar_tarefa", ...entrada }) };
  },
};

const entradaMudarStatus = z.object({
  tarefaId: z.string().describe("id da tarefa (use buscar_tarefas)"),
  statusId: z.string().describe("id do novo status; se não souber, um id inválido devolve as opções da lista"),
});

export const ferramentaProporMudarStatusTarefa: FerramentaNexu<typeof entradaMudarStatus> = {
  nome: "propor_mudar_status_tarefa",
  descricao: `Propõe mudar o status de uma tarefa. ${AVISO}`,
  entrada: entradaMudarStatus,
  permissao: PERMISSAO_DO_TIPO.mudar_status_tarefa,
  rotulo: ROTULO,
  tipo: "proposta",
  async executar(ator, entrada, ctx): Promise<ResultadoProposta> {
    return { proposta: await criarProposta(ator, ctx, { tipo: "mudar_status_tarefa", ...entrada }) };
  },
};

const entradaChecklist = z.object({
  tarefaId: z.string().describe("id da tarefa (use buscar_tarefas)"),
  texto: z.string().describe("texto do item do checklist"),
});

export const ferramentaProporAdicionarChecklist: FerramentaNexu<typeof entradaChecklist> = {
  nome: "propor_adicionar_checklist",
  descricao: `Propõe adicionar um item ao checklist de uma tarefa. ${AVISO}`,
  entrada: entradaChecklist,
  permissao: PERMISSAO_DO_TIPO.adicionar_checklist,
  rotulo: ROTULO,
  tipo: "proposta",
  async executar(ator, entrada, ctx): Promise<ResultadoProposta> {
    return { proposta: await criarProposta(ator, ctx, { tipo: "adicionar_checklist", ...entrada }) };
  },
};

const entradaEvento = z.object({
  tipoId: z.string().describe("id do tipo de evento; se não souber, um id inválido devolve as opções"),
  titulo: z.string().describe("título do evento"),
  dataInicio: z.string().describe(`primeiro dia, ${DIA}`),
  dataFim: z.string().optional().describe(`último dia, ${DIA} (padrão: o mesmo do início)`),
  horaInicio: z.string().optional().describe("hora de início HH:MM (vazio = dia inteiro)"),
  horaFim: z.string().optional().describe("hora de fim HH:MM"),
  turma: z.string().optional().describe("turma, se for de uma turma"),
  local: z.string().optional().describe("local"),
  descricao: z.string().optional().describe("descrição"),
  visivelProfessores: z.boolean().optional().describe("se os professores veem o evento (padrão: não)"),
});

export const ferramentaProporCriarEvento: FerramentaNexu<typeof entradaEvento> = {
  nome: "propor_criar_evento",
  descricao: `Propõe criar um evento na agenda institucional. ${AVISO}`,
  entrada: entradaEvento,
  permissao: PERMISSAO_DO_TIPO.criar_evento,
  rotulo: ROTULO,
  tipo: "proposta",
  async executar(ator, e, ctx): Promise<ResultadoProposta> {
    const proposta = await criarProposta(ator, ctx, {
      tipo: "criar_evento",
      tipoId: e.tipoId,
      titulo: e.titulo,
      dataInicio: e.dataInicio,
      dataFim: e.dataFim || e.dataInicio,
      horaInicio: e.horaInicio || null,
      horaFim: e.horaFim || null,
      turma: e.turma,
      local: e.local,
      descricao: e.descricao,
      visivelProfessores: e.visivelProfessores ?? false,
    });
    return { proposta };
  },
};

const entradaPost = z.object({
  titulo: z.string().describe("título do post"),
  formatoId: z.string().describe("id do formato (define marca e canal principal); se não souber, um id inválido devolve as opções"),
  canalIds: z.array(z.string()).optional().describe("ids de outros canais da mesma marca"),
  dataPublicacao: z.string().optional().describe(`data de publicação, ${DIA}`),
  legenda: z.string().describe("legenda (fica como rascunho)"),
});

export const ferramentaProporCriarPost: FerramentaNexu<typeof entradaPost> = {
  nome: "propor_criar_post",
  descricao: `Propõe criar um post no calendário de conteúdo, com a legenda em rascunho. ${AVISO}`,
  entrada: entradaPost,
  permissao: PERMISSAO_DO_TIPO.criar_post,
  rotulo: ROTULO,
  tipo: "proposta",
  async executar(ator, e, ctx): Promise<ResultadoProposta> {
    const proposta = await criarProposta(ator, ctx, {
      tipo: "criar_post",
      titulo: e.titulo,
      formatoId: e.formatoId,
      canalIds: e.canalIds ?? [],
      dataPublicacao: e.dataPublicacao ?? null,
      legenda: e.legenda,
    });
    return { proposta };
  },
};

const entradaVenda = z.object({
  produtoId: z.string().describe("id do produto (use a ferramenta produtos)"),
  ofertaId: z.string().optional().describe("id da oferta do produto"),
  vendedorId: z.string().optional().describe("id do vendedor (padrão: a própria pessoa)"),
  dataVenda: z.string().describe(`dia da venda, ${DIA}`),
  dataEntradaLead: z.string().optional().describe(`dia em que o lead entrou, ${DIA}`),
  nomeCliente: z.string().describe("nome do cliente"),
  canalId: z.string().optional().describe("id do canal de venda; um id inválido devolve as opções"),
  dataEntrega: z.string().optional().describe(`dia de entrega, ${DIA}`),
  metodoPagamento: z.enum(FORMAS_PAGAMENTO).describe("forma de pagamento"),
  entrada: z.number().optional().describe("valor de entrada em reais"),
  numeroParcelas: z.number().optional().describe("número de parcelas (inteiro, 0 a 60)"),
  valorParcela: z.number().optional().describe("valor de cada parcela em reais"),
  primeiroVencimento: z.string().optional().describe(`primeiro vencimento, ${DIA}`),
});

/** Número em reais → texto que o esquema da venda lê ("1500.00"). */
const reais = (v: number | undefined) => (v === undefined ? undefined : v.toFixed(2));

export const ferramentaProporRegistrarVenda: FerramentaNexu<typeof entradaVenda> = {
  nome: "propor_registrar_venda",
  descricao: `Propõe registrar uma venda. O vendedor só registra no próprio nome. ${AVISO}`,
  entrada: entradaVenda,
  permissao: PERMISSAO_DO_TIPO.registrar_venda,
  rotulo: ROTULO,
  tipo: "proposta",
  async executar(ator, e, ctx): Promise<ResultadoProposta> {
    const proposta = await criarProposta(ator, ctx, {
      tipo: "registrar_venda",
      produtoId: e.produtoId,
      ofertaId: e.ofertaId,
      vendedorId: e.vendedorId || ator.id,
      dataVenda: e.dataVenda,
      dataEntradaLead: e.dataEntradaLead,
      nomeCliente: e.nomeCliente,
      canalId: e.canalId,
      dataEntrega: e.dataEntrega,
      metodoPagamento: e.metodoPagamento,
      entrada: reais(e.entrada),
      numeroParcelas: e.numeroParcelas === undefined ? undefined : String(e.numeroParcelas),
      valorParcela: reais(e.valorParcela),
      primeiroVencimento: e.primeiroVencimento,
    });
    return { proposta };
  },
};
