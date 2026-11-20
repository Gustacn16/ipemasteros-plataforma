import "server-only";
import Anthropic from "@anthropic-ai/sdk";
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
} from "../ia/resumo-grupo";
import { janelaDeOntem } from "../regras/dia";
import { obterConfiguracaoWhatsapp } from "./configuracao";
// Import circular (lote-avaliacao usa as peças daqui): só usado dentro de funções, depois de os dois módulos carregarem.
import { gravarItemAvaliacao } from "./lote-avaliacao";

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

/**
 * A API recusou o envio do lote (resposta 4xx): com certeza nenhum lote foi criado.
 * Qualquer outro erro no envio (tempo esgotado, conexão, 5xx) é incerto: o lote pode ter sido criado.
 */
export class LoteRecusadoError extends Error {
  constructor(readonly status: number) {
    super(`Lote recusado pela API (${status}).`);
    this.name = "LoteRecusadoError";
  }
}

/** 4xx é recusa certa; 408 (tempo esgotado) não garante que nada foi criado. */
export function envioRecusado(e: unknown): e is InstanceType<typeof Anthropic.APIError> & { status: number } {
  return (
    e instanceof Anthropic.APIError && typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.status !== 408
  );
}

export function clienteLotesAnthropic(cliente: Anthropic): ClienteLotes {
  return {
    async criar(requisicoes) {
      try {
        // Sem retentativa: repetir um envio que pode ter dado certo pagaria o lote duas vezes.
        const lote = await cliente.messages.batches.create(
          { requests: requisicoes as Anthropic.Messages.BatchCreateParams.Request[] },
          { maxRetries: 0, timeout: 300_000 },
        );
        return { id: lote.id };
      } catch (e) {
        if (envioRecusado(e)) throw new LoteRecusadoError(e.status);
        throw e;
      }
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

/** O cliente recebido (os testes passam um falso, ou null) ou o da Anthropic; null sem ANTHROPIC_API_KEY. */
export function clienteLotesOuPadrao(cliente: ClienteLotes | null | undefined): ClienteLotes | null {
  if (cliente !== undefined) return cliente;
  const c = obterClienteAnthropic();
  return c ? clienteLotesAnthropic(c) : null;
}

export type ResultadoCriacao = {
  criado: boolean;
  pedidos: number;
  semVerba: number;
  motivo?: "sem_chave" | "ja_existe" | "nada_a_fazer" | "falha_envio" | "envio_incerto";
};

/** Prefixo do custom_id de cada pedido. A API só aceita ^[a-zA-Z0-9_-]{1,64}$ (sem dois-pontos). */
const PREFIXO_CUSTOM_ID = "resumo_";

export const codigoErro = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);

/** Saída esperada de um resumo (raciocínio + JSON) para a conta da verba; o teto do pedido é MAX_TOKENS_RESUMO. */
export const SAIDA_ESTIMADA = 4000;

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
  const lotes = clienteLotesOuPadrao(cliente);
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

  return enviarLoteReservado({
    tipo: "resumo_grupo",
    rotulo: "resumos",
    dia,
    lotes,
    semVerba: semVerba.length,
    gravarSemVerba,
    async gravarPendentes(reservaId) {
      const itens: ItemDoLote[] = [];
      for (const c of cabem) {
        const id = await gravarResumo(c, dia, { situacao: "pendente", erro: null, loteId: reservaId, modelo: config.modelo });
        if (!id) continue; // ficou pronto no meio do caminho
        itens.push({ id, pedido: pedidoResumo(`${PREFIXO_CUSTOM_ID}${id}`, config.modelo, c.texto) });
      }
      return itens;
    },
    async falharPendentesDoLote(reservaId) {
      await prisma.resumoGrupo.updateMany({
        where: { loteId: reservaId, situacao: "pendente" },
        data: { situacao: "falhou", erro: ERRO_ENVIO_LOTE, loteId: null },
      });
    },
    async falharEnviados(ids) {
      await prisma.resumoGrupo.updateMany({
        where: { id: { in: ids }, situacao: { not: "pronto" } },
        data: { situacao: "falhou", erro: ERRO_ENVIO_LOTE, loteId: null },
      });
    },
  });
}

/** Um pedido já gravado como pendente: o id da linha e o pedido para a API. */
export type ItemDoLote = { id: string; pedido: unknown };

/**
 * Reserva o lote do dia (o único tipo + dia barra a execução dupla), grava os itens e envia.
 * Comum aos resumos e às avaliações; a tabela de cada um entra pelas funções recebidas.
 */
export async function enviarLoteReservado(o: {
  tipo: "resumo_grupo" | "avaliacao";
  /** Só para o log ("resumos", "avaliações"). */
  rotulo: string;
  dia: Date;
  lotes: ClienteLotes;
  semVerba: number;
  gravarSemVerba: () => Promise<void>;
  /** Grava os pendentes do lote e devolve os pedidos; quem ficou pronto no caminho fica de fora. */
  gravarPendentes: (reservaId: string) => Promise<ItemDoLote[]>;
  /** Nada foi enviado: os pendentes já gravados deste lote viram falhou e saem do lote. */
  falharPendentesDoLote: (reservaId: string) => Promise<void>;
  /** Recusa certa (4xx): os enviados que não estão prontos viram falhou e saem do lote. */
  falharEnviados: (ids: string[]) => Promise<void>;
}): Promise<ResultadoCriacao> {
  const { tipo, rotulo, dia, lotes, semVerba } = o;
  // Reserva do dia antes de qualquer envio: o único (tipo, dia) barra a execução simultânea.
  let reservaId: string;
  try {
    reservaId = (
      await prisma.loteIa.create({
        data: { tipo, dia, situacao: "aberto", idExterno: null },
        select: { id: true },
      })
    ).id;
  } catch (e) {
    if (codigoErro(e) === "P2002") return { criado: false, pedidos: 0, semVerba: 0, motivo: "ja_existe" };
    throw e;
  }

  let itens: ItemDoLote[];
  try {
    await o.gravarSemVerba();
    itens = await o.gravarPendentes(reservaId);
  } catch (e) {
    // Nada foi enviado: os itens já gravados como pendentes deste lote não podem ficar pendentes para sempre.
    await o.falharPendentesDoLote(reservaId);
    await prisma.loteIa.delete({ where: { id: reservaId } });
    throw e;
  }
  if (itens.length === 0) {
    await prisma.loteIa.delete({ where: { id: reservaId } });
    return { criado: false, pedidos: 0, semVerba, motivo: "nada_a_fazer" };
  }

  let idExterno: string;
  try {
    idExterno = (await lotes.criar(itens.map((i) => i.pedido))).id;
  } catch (e) {
    console.error(`[whatsapp] falha ao criar o lote de ${rotulo}:`, descreverErro(e));
    if (!(e instanceof LoteRecusadoError)) {
      // Tempo esgotado, conexão ou 5xx: o lote pode existir na Anthropic. A reserva fica (sem idExterno) e os
      // itens ficam pendentes; a coleta marca falhou depois de 1 h, e nada é reenviado no mesmo dia.
      return { criado: false, pedidos: 0, semVerba, motivo: "envio_incerto" };
    }
    await o.falharEnviados(itens.map((i) => i.id));
    // Recusa certa (4xx): a reserva sai e uma nova tentativa no mesmo dia pode enviar.
    await prisma.loteIa.delete({ where: { id: reservaId } });
    return { criado: false, pedidos: 0, semVerba, motivo: "falha_envio" };
  }

  try {
    await prisma.loteIa.update({ where: { id: reservaId }, data: { idExterno } });
  } catch (e) {
    // A reserva fica (sem idExterno): nada é reenviado; a coleta marca falhou depois de 1 h.
    // O id externo do lote (não é dado pessoal) vai para o log para a recuperação manual.
    console.error(`[whatsapp] falha ao gravar o id do lote de ${rotulo}:`, descreverErro(e), idExterno);
    throw e;
  }
  return { criado: true, pedidos: itens.length, semVerba };
}

type DadosResumo = { situacao: "pendente" | "falhou"; erro: string | null; loteId: string | null; modelo: string };

/**
 * Grava o resumo do dia sem nunca mexer em um que já está pronto. Gravação sem lote (sem verba) também
 * não mexe em um pendente de outro lote, que ainda vai ser coletado. Devolve o id, ou null se não gravou.
 */
async function gravarResumo(c: Candidato, dia: Date, d: DadosResumo): Promise<string | null> {
  const dados = { ...d, participacao: c.participacao, totalMensagens: c.totalMensagens, resumo: null };
  const r = await prisma.resumoGrupo.updateMany({
    where: {
      conversaId: c.conversaId,
      dia,
      situacao: { not: "pronto" },
      ...(d.loteId === null ? { OR: [{ loteId: null }, { situacao: "falhou" }] } : {}),
    },
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
    if (codigoErro(e) === "P2002") return null; // já existe: pronto, ou pendente de outro lote
    throw e;
  }
}

export const ERRO_NAO_ENVIADO = "O lote não foi enviado.";
export const ERRO_RECUSA = "A IA recusou este resumo.";
export const ERRO_FORMATO = "Resposta fora do formato.";
export const ERRO_GRANDE_DEMAIS = "O resumo ficou grande demais.";
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
type TipoLote = "resumo_grupo" | "avaliacao";

/** Marca falhou os itens (resumos ou avaliações, conforme o tipo do lote) ainda pendentes do lote. Devolve quantos mudaram. */
async function falharPendentes(tipo: TipoLote, loteId: string, erro: string): Promise<number> {
  const where = { loteId, situacao: "pendente" as const };
  const data = { situacao: "falhou" as const, erro };
  const r =
    tipo === "avaliacao"
      ? await prisma.avaliacaoConversa.updateMany({ where, data })
      : await prisma.resumoGrupo.updateMany({ where, data });
  return r.count;
}

/** Encerra o lote como falhou e leva junto os itens pendentes. Devolve quantos itens falharam. */
async function encerrarLoteComFalha(tipo: TipoLote, loteId: string, erro: string, agora: Date): Promise<number> {
  const falhos = await falharPendentes(tipo, loteId, erro);
  await prisma.loteIa.update({ where: { id: loteId }, data: { situacao: "falhou", erro, concluidoEm: agora } });
  return falhos;
}

type Desfecho = { situacao: "pronto"; json: unknown } | { situacao: "falhou"; erro: string };

/** Interpreta um item do lote até o JSON, sem efeito colateral (o uso é registrado depois de reservar o item). */
function desfechoDoItem(item: ResultadoLote): Desfecho {
  const r = item.result;
  if (r.type !== "succeeded") {
    const erro = r.type === "expired" ? ERRO_EXPIROU : r.type === "canceled" ? ERRO_CANCELADO : ERRO_IA;
    return { situacao: "falhou", erro };
  }
  const mensagem = r.message;
  if (mensagem.stop_reason === "refusal") return { situacao: "falhou", erro: ERRO_RECUSA };
  // Cortado no teto: o JSON pode até parecer válido, mas não está completo.
  if (mensagem.stop_reason === "max_tokens") return { situacao: "falhou", erro: ERRO_GRANDE_DEMAIS };
  const bloco = mensagem.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") return { situacao: "falhou", erro: ERRO_FORMATO };
  try {
    return { situacao: "pronto", json: JSON.parse(bloco.text) };
  } catch {
    return { situacao: "falhou", erro: ERRO_FORMATO };
  }
}

/** Gravador de itens do lote (resumos ou avaliações): a tabela de cada um entra pelas funções. */
export type GravadorDoLote<L extends { situacao: string; modelo: string; loteId: string | null }> = {
  prefixo: string;
  /** Só para o log, com o artigo ("o resumo", "a avaliação"). */
  rotulo: string;
  buscar: (id: string) => Promise<L | null>;
  /** Valida o JSON e monta os dados do item pronto; null quando está fora do formato. */
  dadosProntos: (json: unknown, linha: L) => Record<string, unknown> | null;
  /** Gravação condicional: só muda o item se ainda está pendente. Devolve quantos mudaram. */
  gravarSePendente: (id: string, data: Record<string, unknown>) => Promise<number>;
};

/**
 * Grava um item do lote. Devolve o que aconteceu com ele, ou null se nada mudou.
 * A gravação condicional é a reserva: só quem tirou o item de "pendente" registra o uso.
 */
export async function gravarItemDoLote<L extends { situacao: string; modelo: string; loteId: string | null }>(
  item: ResultadoLote,
  loteId: string,
  g: GravadorDoLote<L>,
): Promise<"pronto" | "falhou" | null> {
  const id = item.custom_id.startsWith(g.prefixo) ? item.custom_id.slice(g.prefixo.length) : "";
  if (!id) {
    console.error("[whatsapp] item do lote com custom_id desconhecido: ignorado");
    return null;
  }
  let situacao: "pronto" | "falhou";
  let modeloItem: string;
  try {
    const linha = await g.buscar(id);
    // Coleta repetida (ou item de outro lote): nada a fazer, e o uso já foi registrado.
    if (!linha || linha.situacao !== "pendente" || linha.loteId !== loteId) return null;
    modeloItem = linha.modelo;

    const d = desfechoDoItem(item);
    const dados = d.situacao === "pronto" ? g.dadosProntos(d.json, linha) : null;
    const data =
      dados !== null
        ? { ...dados, situacao: "pronto" as const, erro: null, modelo: modeloItem }
        : { situacao: "falhou" as const, erro: d.situacao === "falhou" ? d.erro : ERRO_FORMATO };
    if ((await g.gravarSePendente(id, data)) === 0) return null;
    situacao = data.situacao;
  } catch (e) {
    console.error(`[whatsapp] falha ao gravar ${g.rotulo} do lote:`, descreverErro(e));
    try {
      const n = await g.gravarSePendente(id, { situacao: "falhou", erro: ERRO_GRAVACAO });
      return n > 0 ? "falhou" : null;
    } catch (e2) {
      console.error(`[whatsapp] falha ao marcar ${g.rotulo} como falhou:`, descreverErro(e2));
      return null;
    }
  }

  // Todo "succeeded" é cobrado, inclusive recusas e respostas fora do formato.
  if (item.result.type === "succeeded") {
    const mensagem = item.result.message;
    // O preço segue o modelo pedido (gravado no item); a resposta pode trazer um nome com sufixo de versão.
    const modelo = ehModeloIa(modeloItem) ? modeloItem : ehModeloIa(mensagem.model) ? mensagem.model : MODELO_RESERVA;
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
      // O item fica como foi gravado; só o registro do uso se perde.
      console.error("[whatsapp] falha ao registrar o uso de IA do lote:", descreverErro(e));
    }
  }
  return situacao;
}

const GRAVADOR_RESUMO: GravadorDoLote<{ situacao: string; modelo: string; loteId: string | null }> = {
  prefixo: PREFIXO_CUSTOM_ID,
  rotulo: "o resumo",
  buscar: (id) => prisma.resumoGrupo.findUnique({ where: { id }, select: { situacao: true, modelo: true, loteId: true } }),
  dadosProntos(json) {
    const validado = esquemaZodResumo.safeParse(json);
    if (!validado.success) return null;
    const d: z.infer<typeof esquemaZodResumo> = validado.data;
    return { resumo: d.resumo, temas: d.temas, pendencias: d.pendencias, destaques: d.destaques };
  },
  async gravarSePendente(id, data) {
    return (await prisma.resumoGrupo.updateMany({ where: { id, situacao: "pendente" }, data })).count;
  },
};

const ROTULO_LOTE: Record<TipoLote, string> = { resumo_grupo: "resumos", avaliacao: "avaliações" };

/**
 * Coleta os lotes abertos (de resumo e de avaliação): grava cada item pronto (ou falhou) na tabela do tipo do
 * lote, registra o uso a preço de lote e encerra o lote. Só mexe em itens ainda pendentes, então pode rodar de
 * novo sem regravar nem cobrar de novo.
 */
export async function coletarLotes(agora: Date = new Date(), cliente?: ClienteLotes | null): Promise<ResultadoColeta> {
  const total: ResultadoColeta = { lotes: 0, prontos: 0, falhos: 0 };
  const lotes = clienteLotesOuPadrao(cliente);
  if (!lotes) return total;

  const abertos = await prisma.loteIa.findMany({
    where: { tipo: { in: ["resumo_grupo", "avaliacao"] }, situacao: "aberto" },
    orderBy: { criadoEm: "asc" },
    select: { id: true, tipo: true, idExterno: true, criadoEm: true },
  });

  for (const lote of abertos) {
    const tipo: TipoLote = lote.tipo;
    const rotulo = ROTULO_LOTE[tipo];
    const idade = agora.getTime() - lote.criadoEm.getTime();
    try {
      if (lote.idExterno === null) {
        if (idade < UMA_HORA_MS) continue; // ainda enviando
        // Não apaga a reserva: o envio pode ter dado certo na Anthropic, e reenviar pagaria duas vezes.
        total.falhos += await encerrarLoteComFalha(tipo, lote.id, ERRO_NAO_ENVIADO, agora);
        total.lotes++;
        continue;
      }

      let situacao: string;
      try {
        situacao = (await lotes.buscar(lote.idExterno)).processing_status;
      } catch (e) {
        if (idade <= PRAZO_LOTE_MS) throw e;
        console.error(`[whatsapp] falha ao consultar o lote de ${rotulo}:`, descreverErro(e));
        situacao = "desconhecido";
      }
      if (situacao !== "ended") {
        if (idade <= PRAZO_LOTE_MS) continue; // ainda processando
        total.falhos += await encerrarLoteComFalha(tipo, lote.id, ERRO_EXPIROU, agora);
        total.lotes++;
        continue;
      }

      try {
        for await (const item of lotes.resultados(lote.idExterno)) {
          const r = tipo === "avaliacao" ? await gravarItemAvaliacao(item, lote.id) : await gravarItem(item, lote.id);
          if (r === "pronto") total.prontos++;
          else if (r === "falhou") total.falhos++;
        }
      } catch (e) {
        if (idade <= PRAZO_LEITURA_MS) throw e; // a próxima coleta tenta de novo
        // Resultado ilegível há dias: desiste para o lote não ficar aberto para sempre.
        console.error(`[whatsapp] falha ao ler o resultado do lote de ${rotulo}:`, descreverErro(e));
        total.falhos += await encerrarLoteComFalha(tipo, lote.id, ERRO_LEITURA, agora);
        total.lotes++;
        continue;
      }
      // Pedido sem resultado (não deveria acontecer): não fica pendente para sempre.
      total.falhos += await falharPendentes(tipo, lote.id, ERRO_SEM_RESULTADO);
      await prisma.loteIa.update({ where: { id: lote.id }, data: { situacao: "concluido", concluidoEm: agora } });
      total.lotes++;
    } catch (e) {
      // O lote fica aberto: a próxima coleta tenta de novo (só os pendentes mudam).
      console.error(`[whatsapp] falha ao coletar o lote de ${rotulo}:`, descreverErro(e));
    }
  }
  return total;
}

/** Grava um item do lote de resumos. Devolve o que aconteceu com o resumo, ou null se nada mudou. */
function gravarItem(item: ResultadoLote, loteId: string): Promise<"pronto" | "falhou" | null> {
  return gravarItemDoLote(item, loteId, GRAVADOR_RESUMO);
}
