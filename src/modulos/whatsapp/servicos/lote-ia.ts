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
  motivo?: "sem_chave" | "ja_existe" | "nada_a_fazer" | "falha_envio";
};

const codigoErro = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);

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
  // Caminho rápido; a trava de verdade é a reserva (único tipo + dia) logo antes do envio.
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
  const cabem: Candidato[] = [];
  const semVerba: Candidato[] = [];
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
    if (estimativa <= restante) {
      restante -= estimativa;
      cabem.push(c);
    } else {
      semVerba.push(c);
    }
  }

  const gravarSemVerba = async () => {
    for (const c of semVerba) {
      await gravarResumo(c, dia, { situacao: "falhou", erro: ERRO_LIMITE_MENSAL, loteId: null, modelo: config.modelo });
    }
  };
  if (cabem.length === 0) {
    await gravarSemVerba();
    return { criado: false, pedidos: 0, semVerba: semVerba.length, motivo: "nada_a_fazer" };
  }

  // Reserva do dia antes de qualquer envio: o único (tipo, dia) barra a execução simultânea.
  let reservaId: string;
  try {
    reservaId = (
      await prisma.loteIa.create({
        data: { tipo: "resumo_grupo", dia, situacao: "aberto", idExterno: null },
        select: { id: true },
      })
    ).id;
  } catch (e) {
    if (codigoErro(e) === "P2002") return { criado: false, pedidos: 0, semVerba: 0, motivo: "ja_existe" };
    throw e;
  }

  const pedidos: PedidoResumo[] = [];
  const enviados: string[] = [];
  try {
    await gravarSemVerba();
    for (const c of cabem) {
      const id = await gravarResumo(c, dia, { situacao: "pendente", erro: null, loteId: reservaId, modelo: config.modelo });
      if (!id) continue; // ficou pronto no meio do caminho
      pedidos.push(pedidoResumo(`resumo:${id}`, config.modelo, c.texto));
      enviados.push(id);
    }
  } catch (e) {
    await prisma.loteIa.delete({ where: { id: reservaId } });
    throw e;
  }
  if (pedidos.length === 0) {
    await prisma.loteIa.delete({ where: { id: reservaId } });
    return { criado: false, pedidos: 0, semVerba: semVerba.length, motivo: "nada_a_fazer" };
  }

  let idExterno: string;
  try {
    idExterno = (await lotes.criar(pedidos)).id;
  } catch (e) {
    console.error("[whatsapp] falha ao criar o lote de resumos:", descreverErro(e));
    await prisma.resumoGrupo.updateMany({
      where: { id: { in: enviados }, situacao: { not: "pronto" } },
      data: { situacao: "falhou", erro: ERRO_ENVIO_LOTE, loteId: null },
    });
    // Sem envio, a reserva sai: uma nova tentativa no mesmo dia pode enviar.
    await prisma.loteIa.delete({ where: { id: reservaId } });
    return { criado: false, pedidos: 0, semVerba: semVerba.length, motivo: "falha_envio" };
  }

  try {
    await prisma.loteIa.update({ where: { id: reservaId }, data: { idExterno } });
  } catch (e) {
    // A reserva fica (sem idExterno): nada é reenviado; a coleta marca falhou depois de 1 h.
    console.error("[whatsapp] falha ao gravar o id do lote de resumos:", descreverErro(e));
    throw e;
  }
  return { criado: true, pedidos: pedidos.length, semVerba: semVerba.length };
}

type DadosResumo = { situacao: "pendente" | "falhou"; erro: string | null; loteId: string | null; modelo: string };

/** Grava o resumo do dia sem nunca mexer em um que já está pronto. Devolve o id, ou null se já estava pronto. */
async function gravarResumo(c: Candidato, dia: Date, d: DadosResumo): Promise<string | null> {
  const dados = { ...d, participacao: c.participacao, totalMensagens: c.totalMensagens, resumo: null };
  const r = await prisma.resumoGrupo.updateMany({
    where: { conversaId: c.conversaId, dia, situacao: { not: "pronto" } },
    data: dados,
  });
  if (r.count > 0) {
    const linha = await prisma.resumoGrupo.findUnique({
      where: { conversaId_dia: { conversaId: c.conversaId, dia } },
      select: { id: true, situacao: true },
    });
    return linha && linha.situacao !== "pronto" ? linha.id : null;
  }
  try {
    return (await prisma.resumoGrupo.create({ data: { conversaId: c.conversaId, dia, ...dados }, select: { id: true } })).id;
  } catch (e) {
    if (codigoErro(e) === "P2002") return null; // já existe e está pronto
    throw e;
  }
}
