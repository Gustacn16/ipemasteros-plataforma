import "server-only";
import type { TimeNumeroWhatsapp } from "@/generated/prisma/enums";
import { calcularCustoMicroUsd, MODELOS_IA, type ModeloIa } from "@/lib/ia/precos";
import { gastoMesMicroUsd } from "@/lib/ia/uso";
import { prisma } from "@/lib/prisma";
import {
  esquemaZodAvaliacaoCs,
  esquemaZodAvaliacaoVendas,
  INSTRUCOES_AVALIACAO,
  MODELO_AVALIACAO,
  montarEntradaAvaliacao,
  pedidoAvaliacao,
  type AvaliacaoCs,
  type AvaliacaoVendas,
  type MensagemParaAvaliacao,
  type TemposParaAvaliacao,
} from "../ia/avaliacao-conversa";
import { INSTRUCOES_RESUMO } from "../ia/resumo-grupo";
import { eventosDaConversa, mediana, type MensagemTempo } from "../regras/atendimento";
import { CRITERIO_TEMPO, CRITERIOS, notaDeTempo, notaGeralDecimos, tipoDoTime, type TipoAvaliacao } from "../regras/avaliacao";
import { chaveTelefone } from "../regras/captura";
import { janelaDeOntem } from "../regras/dia";
import { obterConfiguracaoWhatsapp, obterRegrasAtendimento } from "./configuracao";
import {
  clienteLotesOuPadrao,
  codigoErro,
  enviarLoteReservado,
  ERRO_ENVIO_LOTE,
  ERRO_LIMITE_MENSAL,
  gravarItemDoLote,
  ORIGEM_IA_WHATSAPP,
  SAIDA_ESTIMADA,
  type ClienteLotes,
  type GravadorDoLote,
  type ItemDoLote,
  type ResultadoCriacao,
  type ResultadoLote,
} from "./lote-ia";

/** Prefixo do custom_id de cada pedido de avaliação (a API só aceita ^[a-zA-Z0-9_-]{1,64}$). */
export const PREFIXO_AVALIACAO = "aval_";

const MS_DIA = 86_400_000;
/** Contexto da avaliação: as mensagens dos 14 dias anteriores ao fim de ontem. */
const DIAS_CONTEXTO = 14;
/** Uma venda dos últimos 90 dias com o telefone do contato vira a venda casada da conversa. */
const DIAS_VENDA = 90;
const LOTE_CONVERSAS = 1000;
const TIMES_AVALIADOS: TimeNumeroWhatsapp[] = ["cs", "paciente_modelo", "comercial"];

/** Saída esperada de uma avaliação (raciocínio + JSON) para a conta da verba; o teto é MAX_TOKENS_AVALIACAO. */
const SAIDA_ESTIMADA_AVALIACAO = 3000;
/**
 * Reserva das pendentes, que já não têm o texto à mão: uma avaliação pendente conta 8.000 tokens de entrada
 * (instruções ~1.200 + uma conversa típica de 14 dias); um resumo pendente conta as instruções mais
 * 30 tokens por mensagem do dia (uma linha "[hh:mm] Nome: texto" curta).
 */
const ENTRADA_ESTIMADA_AVALIACAO_PENDENTE = 8000;
const TOKENS_POR_MENSAGEM_RESUMO = 30;

const ehModeloIa = (m: unknown): m is ModeloIa => typeof m === "string" && (MODELOS_IA as readonly string[]).includes(m);

/** Estimativa do custo (micro-dólares, preço de lote) dos resumos e das avaliações ainda pendentes, item a item. */
export async function reservaPendentesMicroUsd(): Promise<number> {
  const [config, resumos, avaliacoes] = await Promise.all([
    obterConfiguracaoWhatsapp(),
    prisma.resumoGrupo.findMany({ where: { situacao: "pendente" }, select: { totalMensagens: true, modelo: true } }),
    prisma.avaliacaoConversa.count({ where: { situacao: "pendente" } }),
  ]);
  const instrucoesResumo = Math.ceil(INSTRUCOES_RESUMO.length / 3);
  let total = 0;
  for (const r of resumos) {
    total += calcularCustoMicroUsd(
      ehModeloIa(r.modelo) ? r.modelo : config.modelo,
      {
        entrada: instrucoesResumo + r.totalMensagens * TOKENS_POR_MENSAGEM_RESUMO,
        cacheEscrita: 0,
        cacheLeitura: 0,
        saida: SAIDA_ESTIMADA,
      },
      { lote: true },
    );
  }
  const porAvaliacao = calcularCustoMicroUsd(
    MODELO_AVALIACAO,
    { entrada: ENTRADA_ESTIMADA_AVALIACAO_PENDENTE, cacheEscrita: 0, cacheLeitura: 0, saida: SAIDA_ESTIMADA_AVALIACAO },
    { lote: true },
  );
  return total + avaliacoes * porAvaliacao;
}

type Candidata = {
  conversaId: string;
  numeroId: string;
  time: TimeNumeroWhatsapp;
  tipo: TipoAvaliacao;
  texto: string;
  mensagensOntem: number;
  notaTempo: number | null;
  vendaId: string | null;
};

const emMinutos = (seg: number | null) => (seg === null ? null : Math.round(seg / 60));

/** Tempos de ontem para a IA comentar: das vezes do cliente que começaram ontem. */
function temposDeOntem(
  todas: MensagemTempo[],
  ontem: { inicio: Date; fim: Date },
  regras: Awaited<ReturnType<typeof obterRegrasAtendimento>>,
): TemposParaAvaliacao {
  const { vezes } = eventosDaConversa(todas, ontem.fim, regras);
  const limite = regras.slaMinutos * 60;
  // Vez ainda aberta só conta (como fora do SLA) se o tempo útil já passou do SLA; senão não dá para julgar.
  const deOntem = vezes.filter((v) => v.inicio >= ontem.inicio && v.inicio < ontem.fim && (v.respondidaEm !== null || v.segundos > limite));
  if (deOntem.length === 0) return { primeiraRespostaMin: null, respostaMin: null, noSla: null };
  const respondidas = deOntem.filter((v) => v.respondidaEm !== null);
  const noSla = respondidas.filter((v) => v.segundos <= limite).length;
  return {
    primeiraRespostaMin: deOntem[0]!.respondidaEm ? emMinutos(deOntem[0]!.segundos) : null,
    respostaMin: emMinutos(mediana(respondidas.map((v) => v.segundos))),
    noSla: `${noSla} de ${deOntem.length}`,
  };
}

/**
 * Venda mais recente (não excluída, dos 90 dias até `fim`) de cada chave de telefone pedida. Uma consulta só:
 * o `whatsappCliente` é normalizado aqui (como em cs.ts), porque vendas importadas podem trazer pontuação,
 * e um `in` com as variantes do telefone não casaria "+55 (11) 99999-8888".
 */
async function vendasPorChave(chaves: Set<string>, fim: Date): Promise<Map<string, string>> {
  const porChave = new Map<string, string>();
  if (chaves.size === 0) return porChave;
  const vendas = await prisma.venda.findMany({
    where: { excluidoEm: null, whatsappCliente: { not: null }, criadoEm: { gte: new Date(fim.getTime() - DIAS_VENDA * MS_DIA), lt: fim } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, whatsappCliente: true },
  });
  for (const v of vendas) {
    const chave = chaveTelefone(v.whatsappCliente?.replace(/\D/g, "") ?? null);
    if (chave && chaves.has(chave) && !porChave.has(chave)) porChave.set(chave, v.id); // a primeira é a mais recente
  }
  return porChave;
}

/**
 * Monta e envia um lote por dia com um pedido de avaliação por conversa de lead ou aluno (dos times de
 * vendas e de CS) que teve mensagem ontem. Respeita a verba mensal do WhatsApp, já descontada a reserva dos
 * pendentes: vendas entram antes de CS e, em cada uma, quem teve mais mensagens ontem vem primeiro.
 */
export async function criarLoteAvaliacoes(agora: Date = new Date(), cliente?: ClienteLotes | null): Promise<ResultadoCriacao> {
  const lotes = clienteLotesOuPadrao(cliente);
  if (!lotes) return { criado: false, pedidos: 0, semVerba: 0, motivo: "sem_chave" };

  const { dia, inicio, fim } = janelaDeOntem(agora);
  const ontem = { inicio, fim };
  // Caminho rápido; a trava de verdade é a reserva (único tipo + dia) logo antes do envio.
  const existente = await prisma.loteIa.findFirst({ where: { tipo: "avaliacao", dia }, select: { id: true } });
  if (existente) return { criado: false, pedidos: 0, semVerba: 0, motivo: "ja_existe" };

  const [conversas, prontas] = await Promise.all([
    prisma.conversaWhatsapp.findMany({
      where: {
        tipo: "individual",
        categoria: { in: ["lead", "aluno"] },
        numero: { excluidoEm: null, time: { in: TIMES_AVALIADOS } },
        mensagens: { some: { enviadaEm: { gte: inicio, lt: fim } } },
      },
      select: { id: true, numeroId: true, numero: { select: { time: true } }, contato: { select: { telefone: true } } },
    }),
    prisma.avaliacaoConversa.findMany({ where: { dia, situacao: "pronto" }, select: { conversaId: true } }),
  ]);
  const jaProntas = new Set(prontas.map((p) => p.conversaId));
  const alvo = conversas.filter((c) => c.numeroId && c.numero && tipoDoTime(c.numero.time) && !jaProntas.has(c.id));

  // Mensagens dos 14 dias em blocos de conversas, sem consulta por conversa.
  const desde = new Date(fim.getTime() - DIAS_CONTEXTO * MS_DIA);
  const porConversa = new Map<string, MensagemParaAvaliacao[]>();
  for (let i = 0; i < alvo.length; i += LOTE_CONVERSAS) {
    const mensagens = await prisma.mensagemWhatsapp.findMany({
      where: { conversaId: { in: alvo.slice(i, i + LOTE_CONVERSAS).map((c) => c.id) }, enviadaEm: { gte: desde, lt: fim } },
      select: { conversaId: true, enviadaEm: true, deMim: true, tipo: true, texto: true },
      orderBy: [{ enviadaEm: "asc" }, { id: "asc" }],
    });
    for (const m of mensagens) {
      const lista = porConversa.get(m.conversaId) ?? [];
      lista.push({ enviadaEm: m.enviadaEm, deMim: m.deMim, tipo: m.tipo, texto: m.texto });
      porConversa.set(m.conversaId, lista);
    }
  }

  const chaveDe = new Map<string, string>();
  for (const c of alvo) {
    if (tipoDoTime(c.numero!.time) !== "vendas") continue;
    const chave = chaveTelefone(c.contato?.telefone ?? null);
    if (chave) chaveDe.set(c.id, chave);
  }
  const vendas = await vendasPorChave(new Set(chaveDe.values()), fim);

  const [config, regras] = await Promise.all([obterConfiguracaoWhatsapp(), obterRegrasAtendimento()]);
  const candidatas: Candidata[] = [];
  for (const c of alvo) {
    const mensagens = porConversa.get(c.id);
    if (!mensagens?.length) continue;
    const tipo = tipoDoTime(c.numero!.time)!;
    const tempos = temposDeOntem(mensagens, ontem, regras);
    const chave = chaveDe.get(c.id);
    candidatas.push({
      conversaId: c.id,
      numeroId: c.numeroId!,
      time: c.numero!.time,
      tipo,
      texto: montarEntradaAvaliacao(mensagens, ontem, tempos).texto,
      mensagensOntem: mensagens.filter((m) => m.enviadaEm >= inicio && m.enviadaEm < fim).length,
      notaTempo: notaDeTempo(mensagens, ontem, regras),
      vendaId: chave ? (vendas.get(chave) ?? null) : null,
    });
  }

  // Verba: vendas antes de CS; em cada tipo, as mais movimentadas ontem primeiro.
  const ordemTipo = (t: TipoAvaliacao) => (t === "vendas" ? 0 : 1);
  candidatas.sort((a, b) => ordemTipo(a.tipo) - ordemTipo(b.tipo) || b.mensagensOntem - a.mensagensOntem);
  let restante =
    config.limiteMensalMicroUsd - (await gastoMesMicroUsd(ORIGEM_IA_WHATSAPP, agora)) - (await reservaPendentesMicroUsd());
  const cabem: Candidata[] = [];
  const semVerba: Candidata[] = [];
  for (const c of candidatas) {
    const estimativa = calcularCustoMicroUsd(
      MODELO_AVALIACAO,
      {
        entrada: Math.ceil((INSTRUCOES_AVALIACAO[c.tipo].length + c.texto.length) / 3),
        cacheEscrita: 0,
        cacheLeitura: 0,
        saida: SAIDA_ESTIMADA_AVALIACAO,
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
    for (const c of semVerba) await gravarAvaliacao(c, dia, { situacao: "falhou", erro: ERRO_LIMITE_MENSAL, loteId: null });
  };
  if (cabem.length === 0) {
    await gravarSemVerba();
    return { criado: false, pedidos: 0, semVerba: semVerba.length, motivo: "nada_a_fazer" };
  }

  return enviarLoteReservado({
    tipo: "avaliacao",
    rotulo: "avaliações",
    dia,
    lotes,
    semVerba: semVerba.length,
    gravarSemVerba,
    async gravarPendentes(reservaId) {
      const itens: ItemDoLote[] = [];
      for (const c of cabem) {
        const id = await gravarAvaliacao(c, dia, { situacao: "pendente", erro: null, loteId: reservaId });
        if (!id) continue; // ficou pronta no meio do caminho
        itens.push({ id, pedido: pedidoAvaliacao(`${PREFIXO_AVALIACAO}${id}`, c.tipo, c.texto) });
      }
      return itens;
    },
    async falharPendentesDoLote(reservaId) {
      await prisma.avaliacaoConversa.updateMany({
        where: { loteId: reservaId, situacao: "pendente" },
        data: { situacao: "falhou", erro: ERRO_ENVIO_LOTE, loteId: null },
      });
    },
    async falharEnviados(ids) {
      await prisma.avaliacaoConversa.updateMany({
        where: { id: { in: ids }, situacao: { not: "pronto" } },
        data: { situacao: "falhou", erro: ERRO_ENVIO_LOTE, loteId: null },
      });
    },
  });
}

type DadosAvaliacao = { situacao: "pendente" | "falhou"; erro: string | null; loteId: string | null };

/**
 * Grava a avaliação do dia sem nunca mexer em uma que já está pronta. Gravação sem lote (sem verba) também
 * não mexe em uma pendente de outro lote, que ainda vai ser coletada. Devolve o id, ou null se não gravou.
 */
async function gravarAvaliacao(c: Candidata, dia: Date, d: DadosAvaliacao): Promise<string | null> {
  const dados = { ...d, numeroId: c.numeroId, time: c.time, modelo: MODELO_AVALIACAO, notaTempo: c.notaTempo, vendaId: c.vendaId };
  const r = await prisma.avaliacaoConversa.updateMany({
    where: {
      conversaId: c.conversaId,
      dia,
      situacao: { not: "pronto" },
      ...(d.loteId === null ? { OR: [{ loteId: null }, { situacao: "falhou" }] } : {}),
    },
    data: dados,
  });
  if (r.count > 0) {
    const linha = await prisma.avaliacaoConversa.findUnique({
      where: { conversaId_dia: { conversaId: c.conversaId, dia } },
      select: { id: true, situacao: true },
    });
    return linha && linha.situacao !== "pronto" ? linha.id : null;
  }
  try {
    return (await prisma.avaliacaoConversa.create({ data: { conversaId: c.conversaId, dia, ...dados }, select: { id: true } })).id;
  } catch (e) {
    if (codigoErro(e) === "P2002") return null; // já existe: pronta, ou pendente de outro lote
    throw e;
  }
}

// ─── Coleta ──────────────────────────────────────────────────────────────────

type LinhaAvaliacao = {
  situacao: string;
  modelo: string;
  loteId: string | null;
  time: TimeNumeroWhatsapp;
  notaTempo: number | null;
  vendaId: string | null;
};

/** Item da lista `criterios` gravada: a nota null é "não se aplica". */
export type CriterioGravado = { chave: string; nota: number | null; frase: string };

/** Lista de pontos guardada como texto, um por linha; vazia vira null. */
const comoTexto = (lista: string[]) => {
  const linhas = lista.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  return linhas.length > 0 ? linhas.join("\n") : null;
};

/**
 * Monta os dados de uma avaliação pronta. O zod segue o tipo do time gravado na criação. A lista de critérios
 * segue a ordem de CRITERIOS[tipo] e termina com o tempo de resposta do sistema (frase vazia: a tela usa o rótulo
 * de CRITERIO_TEMPO). A nota geral é a média de todas essas notas. Com venda casada, a situação é "fechou".
 */
function dadosAvaliacaoPronta(json: unknown, linha: LinhaAvaliacao): Record<string, unknown> | null {
  const tipo = tipoDoTime(linha.time);
  if (!tipo) return null;
  let d: AvaliacaoCs;
  let vendas: AvaliacaoVendas | null = null; // só vendas tem situação e temperatura; em CS ficam null
  if (tipo === "vendas") {
    const v = esquemaZodAvaliacaoVendas.safeParse(json);
    if (!v.success) return null;
    d = vendas = v.data;
  } else {
    const v = esquemaZodAvaliacaoCs.safeParse(json);
    if (!v.success) return null;
    d = v.data;
  }

  const criterios: CriterioGravado[] = CRITERIOS[tipo].map((c) => ({
    chave: c.chave,
    nota: d.criterios[c.chave]?.nota ?? null,
    frase: d.criterios[c.chave]?.frase ?? "",
  }));
  criterios.push({ chave: CRITERIO_TEMPO.chave, nota: linha.notaTempo, frase: "" });

  return {
    situacaoLead: vendas ? (linha.vendaId ? "fechou" : vendas.situacao) : null,
    temperatura: vendas ? vendas.temperatura : null,
    motivoTemperatura: vendas ? vendas.motivoTemperatura.trim() : null,
    oQueRespondeu: d.oQueRespondeu.trim(),
    proximoPasso: d.proximoPasso.trim(),
    criterios,
    notaGeralDecimos: notaGeralDecimos(criterios.map((c) => c.nota)),
    pontosFortes: comoTexto(d.pontosFortes),
    melhorar: comoTexto(d.melhorar),
  };
}

const GRAVADOR_AVALIACAO: GravadorDoLote<LinhaAvaliacao> = {
  prefixo: PREFIXO_AVALIACAO,
  rotulo: "a avaliação",
  buscar: (id) =>
    prisma.avaliacaoConversa.findUnique({
      where: { id },
      select: { situacao: true, modelo: true, loteId: true, time: true, notaTempo: true, vendaId: true },
    }),
  dadosProntos: dadosAvaliacaoPronta,
  async gravarSePendente(id, data) {
    return (await prisma.avaliacaoConversa.updateMany({ where: { id, situacao: "pendente" }, data })).count;
  },
};

/**
 * Grava um item do lote de avaliações, com as mesmas regras do resumo: só quem tira a avaliação de "pendente"
 * registra o uso (a preço de lote, pelo modelo gravado). Devolve o que aconteceu, ou null se nada mudou.
 */
export function gravarItemAvaliacao(item: ResultadoLote, loteId: string): Promise<"pronto" | "falhou" | null> {
  return gravarItemDoLote(item, loteId, GRAVADOR_AVALIACAO);
}
