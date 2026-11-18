import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { obterClienteAnthropic } from "@/lib/ia/cliente";
import { calcularCustoMicroUsd, MODELOS_IA, type ModeloIa } from "@/lib/ia/precos";
import { gastoMesMicroUsd, registrarUsoIa } from "@/lib/ia/uso";
import { prisma } from "@/lib/prisma";
import { descreverErro } from "@/modulos/nexu/servicos/descrever-erro";
import {
  esquemaZodResumo,
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

/** Prefixo do custom_id de cada pedido. A API só aceita ^[a-zA-Z0-9_-]{1,64}$ (sem dois-pontos). */
const PREFIXO_CUSTOM_ID = "resumo_";

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
      pedidos.push(pedidoResumo(`${PREFIXO_CUSTOM_ID}${id}`, config.modelo, c.texto));
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

export const ERRO_NAO_ENVIADO = "O lote não foi enviado.";
export const ERRO_RECUSA = "A IA recusou este resumo.";
export const ERRO_FORMATO = "Resposta fora do formato.";
export const ERRO_IA = "Erro da IA.";
export const ERRO_EXPIROU = "O pedido expirou.";
export const ERRO_CANCELADO = "O pedido foi cancelado.";
export const ERRO_SEM_RESULTADO = "A IA não devolveu este resumo.";
export const ERRO_GRAVACAO = "Não foi possível salvar o resumo.";
export const ERRO_LEITURA = "Não foi possível ler o resultado do lote.";

const UMA_HORA_MS = 3_600_000;
/** A Anthropic encerra um lote em até 24 h; com 25 h sem "ended", desistimos. */
const PRAZO_LOTE_MS = 25 * UMA_HORA_MS;
/** Lote encerrado cujo resultado não se consegue ler: depois de 7 dias, desistimos. */
const PRAZO_LEITURA_MS = 7 * 24 * UMA_HORA_MS;
const MODELO_RESERVA: ModeloIa = "claude-opus-5-5";

const ehModeloIa = (m: unknown): m is ModeloIa => typeof m === "string" && (MODELOS_IA as readonly string[]).includes(m);

type ResultadoColeta = { lotes: number; prontos: number; falhos: number };

/** Marca falhou os resumos ainda pendentes do lote. Devolve quantos mudaram. */
async function falharPendentes(loteId: string, erro: string): Promise<number> {
  const r = await prisma.resumoGrupo.updateMany({
    where: { loteId, situacao: "pendente" },
    data: { situacao: "falhou", erro },
  });
  return r.count;
}

/** Encerra o lote como falhou e leva junto os resumos pendentes. Devolve quantos resumos falharam. */
async function encerrarLoteComFalha(loteId: string, erro: string, agora: Date): Promise<number> {
  const falhos = await falharPendentes(loteId, erro);
  await prisma.loteIa.update({ where: { id: loteId }, data: { situacao: "falhou", erro, concluidoEm: agora } });
  return falhos;
}

type Desfecho =
  | { situacao: "pronto"; dados: z.infer<typeof esquemaZodResumo> }
  | { situacao: "falhou"; erro: string };

/** Interpreta um item do lote, sem efeito colateral (o uso é registrado depois de reservar o resumo). */
function desfechoDoItem(item: ResultadoLote): Desfecho {
  const r = item.result;
  if (r.type !== "succeeded") {
    const erro = r.type === "expired" ? ERRO_EXPIROU : r.type === "canceled" ? ERRO_CANCELADO : ERRO_IA;
    return { situacao: "falhou", erro };
  }
  const mensagem = r.message;
  if (mensagem.stop_reason === "refusal") return { situacao: "falhou", erro: ERRO_RECUSA };
  const bloco = mensagem.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") return { situacao: "falhou", erro: ERRO_FORMATO };
  let json: unknown;
  try {
    json = JSON.parse(bloco.text);
  } catch {
    return { situacao: "falhou", erro: ERRO_FORMATO };
  }
  const validado = esquemaZodResumo.safeParse(json);
  if (!validado.success) return { situacao: "falhou", erro: ERRO_FORMATO };
  return { situacao: "pronto", dados: validado.data };
}

/**
 * Coleta os lotes de resumo abertos: grava cada resumo pronto (ou falhou), registra o uso a preço de lote
 * e encerra o lote. Só mexe em resumos ainda pendentes, então pode rodar de novo sem regravar nem cobrar de novo.
 */
export async function coletarLotes(agora: Date = new Date(), cliente?: ClienteLotes | null): Promise<ResultadoColeta> {
  const total: ResultadoColeta = { lotes: 0, prontos: 0, falhos: 0 };
  const lotes =
    cliente === undefined ? ((c) => (c ? clienteLotesAnthropic(c) : null))(obterClienteAnthropic()) : cliente;
  if (!lotes) return total;

  const abertos = await prisma.loteIa.findMany({
    where: { tipo: "resumo_grupo", situacao: "aberto" },
    orderBy: { criadoEm: "asc" },
    select: { id: true, idExterno: true, criadoEm: true },
  });

  for (const lote of abertos) {
    const idade = agora.getTime() - lote.criadoEm.getTime();
    try {
      if (lote.idExterno === null) {
        if (idade < UMA_HORA_MS) continue; // ainda enviando
        // Não apaga a reserva: o envio pode ter dado certo na Anthropic, e reenviar pagaria duas vezes.
        total.falhos += await encerrarLoteComFalha(lote.id, ERRO_NAO_ENVIADO, agora);
        total.lotes++;
        continue;
      }

      let situacao: string;
      try {
        situacao = (await lotes.buscar(lote.idExterno)).processing_status;
      } catch (e) {
        if (idade <= PRAZO_LOTE_MS) throw e;
        console.error("[whatsapp] falha ao consultar o lote de resumos:", descreverErro(e));
        situacao = "desconhecido";
      }
      if (situacao !== "ended") {
        if (idade <= PRAZO_LOTE_MS) continue; // ainda processando
        total.falhos += await encerrarLoteComFalha(lote.id, ERRO_EXPIROU, agora);
        total.lotes++;
        continue;
      }

      try {
        for await (const item of lotes.resultados(lote.idExterno)) {
          const r = await gravarItem(item, lote.id);
          if (r === "pronto") total.prontos++;
          else if (r === "falhou") total.falhos++;
        }
      } catch (e) {
        if (idade <= PRAZO_LEITURA_MS) throw e; // a próxima coleta tenta de novo
        // Resultado ilegível há dias: desiste para o lote não ficar aberto para sempre.
        console.error("[whatsapp] falha ao ler o resultado do lote de resumos:", descreverErro(e));
        total.falhos += await encerrarLoteComFalha(lote.id, ERRO_LEITURA, agora);
        total.lotes++;
        continue;
      }
      // Pedido sem resultado (não deveria acontecer): não fica pendente para sempre.
      total.falhos += await falharPendentes(lote.id, ERRO_SEM_RESULTADO);
      await prisma.loteIa.update({ where: { id: lote.id }, data: { situacao: "concluido", concluidoEm: agora } });
      total.lotes++;
    } catch (e) {
      // O lote fica aberto: a próxima coleta tenta de novo (só os pendentes mudam).
      console.error("[whatsapp] falha ao coletar o lote de resumos:", descreverErro(e));
    }
  }
  return total;
}

/** Grava um item do lote. Devolve o que aconteceu com o resumo, ou null se nada mudou. */
async function gravarItem(item: ResultadoLote, loteId: string): Promise<"pronto" | "falhou" | null> {
  const id = item.custom_id.startsWith(PREFIXO_CUSTOM_ID) ? item.custom_id.slice(PREFIXO_CUSTOM_ID.length) : "";
  if (!id) {
    console.error("[whatsapp] item do lote com custom_id desconhecido: ignorado");
    return null;
  }
  let situacao: "pronto" | "falhou";
  let modeloResumo: string;
  try {
    const resumo = await prisma.resumoGrupo.findUnique({
      where: { id },
      select: { situacao: true, modelo: true, loteId: true },
    });
    // Coleta repetida (ou item de outro lote): nada a fazer, e o uso já foi registrado.
    if (!resumo || resumo.situacao !== "pendente" || resumo.loteId !== loteId) return null;
    modeloResumo = resumo.modelo;

    const d = desfechoDoItem(item);
    const data =
      d.situacao === "pronto"
        ? {
            situacao: "pronto" as const,
            erro: null,
            resumo: d.dados.resumo,
            temas: d.dados.temas,
            pendencias: d.dados.pendencias,
            destaques: d.dados.destaques,
            modelo: modeloResumo,
          }
        : { situacao: "falhou" as const, erro: d.erro };
    // A gravação condicional é a reserva: só quem tirou o resumo de "pendente" registra o uso.
    const r = await prisma.resumoGrupo.updateMany({ where: { id, situacao: "pendente" }, data });
    if (r.count === 0) return null;
    situacao = d.situacao;
  } catch (e) {
    console.error("[whatsapp] falha ao gravar um resumo do lote:", descreverErro(e));
    try {
      const r = await prisma.resumoGrupo.updateMany({
        where: { id, situacao: "pendente" },
        data: { situacao: "falhou", erro: ERRO_GRAVACAO },
      });
      return r.count > 0 ? "falhou" : null;
    } catch (e2) {
      console.error("[whatsapp] falha ao marcar o resumo como falhou:", descreverErro(e2));
      return null;
    }
  }

  // Todo "succeeded" é cobrado, inclusive recusas e respostas fora do formato.
  if (item.result.type === "succeeded") {
    const mensagem = item.result.message;
    // O preço segue o modelo pedido (ResumoGrupo.modelo); a resposta pode trazer um nome com sufixo de versão.
    const modelo = ehModeloIa(modeloResumo) ? modeloResumo : ehModeloIa(mensagem.model) ? mensagem.model : MODELO_RESERVA;
    try {
      await registrarUsoIa({
        origem: ORIGEM_IA_WHATSAPP,
        usuarioId: null,
        modelo,
        inicioPergunta: false,
        usage: mensagem.usage,
        lote: true,
      });
    } catch (e) {
      // O resumo fica como foi gravado; só o registro do uso se perde.
      console.error("[whatsapp] falha ao registrar o uso de IA do lote:", descreverErro(e));
    }
  }
  return situacao;
}
