import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { obterClienteAnthropic } from "@/lib/ia/cliente";
import { calcularCustoMicroUsd } from "@/lib/ia/precos";
import { gastoMesMicroUsd } from "@/lib/ia/uso";
import { prisma } from "@/lib/prisma";
import { descreverErro } from "@/modulos/nexu/servicos/descrever-erro";
import {
  INSTRUCOES_RESUMO,
  montarEntradaResumo,
  participacaoDoDia,
  pedidoResumo,
  type MensagemParaResumo,
  type PedidoResumo,
} from "../ia/resumo-grupo";
import { janelaDeOntem } from "../regras/dia";
import { obterConfiguracaoWhatsapp } from "./configuracao";

export const ORIGEM_IA_WHATSAPP = "whatsapp";
export const ERRO_LIMITE_MENSAL = "Limite mensal de IA do WhatsApp atingido.";
export const ERRO_ENVIO_LOTE = "Não foi possível enviar o lote.";

/** Um resultado da API de lotes (só o que a coleta usa). */
export type ResultadoLote = {
  custom_id: string;
  result: { type: "succeeded"; message: Anthropic.Message } | { type: "errored" | "canceled" | "expired" };
};

/** Adaptador da API de lotes: os testes usam um cliente falso. */
export type ClienteLotes = {
  criar(requisicoes: unknown[]): Promise<{ id: string }>;
  buscar(id: string): Promise<{ processing_status: string }>;
  resultados(id: string): AsyncIterable<ResultadoLote>;
};

export function clienteLotesAnthropic(cliente: Anthropic): ClienteLotes {
  return {
    async criar(requisicoes) {
      const lote = await cliente.messages.batches.create({
        requests: requisicoes as Anthropic.Messages.BatchCreateParams.Request[],
      });
      return { id: lote.id };
    },
    async buscar(id) {
      const lote = await cliente.messages.batches.retrieve(id);
      return { processing_status: lote.processing_status };
    },
    async *resultados(id) {
      for await (const r of await cliente.messages.batches.results(id)) {
        yield r as ResultadoLote;
      }
    },
  };
}

type ResultadoCriacao = {
  criado: boolean;
  pedidos: number;
  semVerba: number;
  motivo?: "sem_chave" | "ja_existe" | "nada_a_fazer";
};

const SAIDA_ESTIMADA = 8000;

type Candidato = {
  conversaId: string;
  texto: string;
  totalMensagens: number;
  participacao: ReturnType<typeof participacaoDoDia>;
};

/**
 * Monta e envia um lote por dia com um pedido de resumo por grupo monitorado que teve mensagem ontem.
 * Respeita a verba mensal do WhatsApp: os grupos com mais mensagens entram primeiro.
 */
export async function criarLoteDoDia(
  agora: Date = new Date(),
  cliente?: ClienteLotes | null,
): Promise<ResultadoCriacao> {
  const lotes =
    cliente === undefined ? ((c) => (c ? clienteLotesAnthropic(c) : null))(obterClienteAnthropic()) : cliente;
  if (!lotes) return { criado: false, pedidos: 0, semVerba: 0, motivo: "sem_chave" };

  const { dia, inicio, fim } = janelaDeOntem(agora);
  // Trava contra execução dupla: um lote de resumo por dia.
  const existente = await prisma.loteIa.findFirst({ where: { tipo: "resumo_grupo", dia }, select: { id: true } });
  if (existente) return { criado: false, pedidos: 0, semVerba: 0, motivo: "ja_existe" };

  const config = await obterConfiguracaoWhatsapp();
  const grupos = await prisma.conversaWhatsapp.findMany({
    where: { tipo: "grupo", monitorada: true },
    select: { id: true, nome: true, turma: { select: { nome: true } } },
  });

  const candidatos: Candidato[] = [];
  for (const g of grupos) {
    const pronto = await prisma.resumoGrupo.findUnique({
      where: { conversaId_dia: { conversaId: g.id, dia } },
      select: { situacao: true },
    });
    if (pronto?.situacao === "pronto") continue;

    const linhas = await prisma.mensagemWhatsapp.findMany({
      where: { conversaId: g.id, enviadaEm: { gte: inicio, lt: fim } },
      orderBy: { enviadaEm: "asc" },
      select: {
        enviadaEm: true,
        deMim: true,
        tipo: true,
        texto: true,
        contato: { select: { nomeExibido: true, usuarioId: true } },
      },
    });
    if (linhas.length === 0) continue;

    const mensagens: MensagemParaResumo[] = linhas.map((m) => ({
      enviadaEm: m.enviadaEm,
      autor: m.deMim ? "Equipe IPEMaster" : m.contato?.nomeExibido?.trim() || "Participante",
      equipe: m.deMim || m.contato?.usuarioId != null,
      tipo: m.tipo,
      texto: m.texto,
    }));
    const { texto } = montarEntradaResumo({ nome: g.nome, turma: g.turma?.nome ?? null }, mensagens);
    candidatos.push({
      conversaId: g.id,
      texto,
      totalMensagens: mensagens.length,
      participacao: participacaoDoDia(mensagens),
    });
  }

  // Verba: os grupos mais movimentados entram primeiro; quem não cabe fica "falhou" com o aviso do limite.
  candidatos.sort((a, b) => b.totalMensagens - a.totalMensagens);
  let restante = config.limiteMensalMicroUsd - (await gastoMesMicroUsd(ORIGEM_IA_WHATSAPP, agora));
  const pedidos: PedidoResumo[] = [];
  const enviados: string[] = [];
  let semVerba = 0;

  for (const c of candidatos) {
    const estimativa = calcularCustoMicroUsd(
      config.modelo,
      {
        entrada: Math.ceil((INSTRUCOES_RESUMO.length + c.texto.length) / 3),
        cacheEscrita: 0,
        cacheLeitura: 0,
        saida: SAIDA_ESTIMADA,
      },
      { lote: true },
    );
    const cabe = estimativa <= restante;
    const dados = {
      participacao: c.participacao,
      totalMensagens: c.totalMensagens,
      modelo: config.modelo,
      situacao: cabe ? ("pendente" as const) : ("falhou" as const),
      erro: cabe ? null : ERRO_LIMITE_MENSAL,
      loteId: null,
      resumo: null,
    };
    const resumo = await prisma.resumoGrupo.upsert({
      where: { conversaId_dia: { conversaId: c.conversaId, dia } },
      create: { conversaId: c.conversaId, dia, ...dados },
      update: dados,
      select: { id: true },
    });
    if (!cabe) {
      semVerba++;
      continue;
    }
    restante -= estimativa;
    pedidos.push(pedidoResumo(`resumo:${resumo.id}`, config.modelo, c.texto));
    enviados.push(resumo.id);
  }

  if (pedidos.length === 0) return { criado: false, pedidos: 0, semVerba, motivo: "nada_a_fazer" };

  let idExterno: string;
  try {
    idExterno = (await lotes.criar(pedidos)).id;
  } catch (e) {
    console.error("[whatsapp] falha ao criar o lote de resumos:", descreverErro(e));
    await prisma.resumoGrupo.updateMany({
      where: { id: { in: enviados }, situacao: { not: "pronto" } },
      data: { situacao: "falhou", erro: ERRO_ENVIO_LOTE },
    });
    return { criado: false, pedidos: 0, semVerba };
  }

  const lote = await prisma.loteIa.create({ data: { idExterno, tipo: "resumo_grupo", dia }, select: { id: true } });
  await prisma.resumoGrupo.updateMany({
    where: { id: { in: enviados }, situacao: { not: "pronto" } },
    data: { loteId: lote.id },
  });
  return { criado: true, pedidos: pedidos.length, semVerba };
}
