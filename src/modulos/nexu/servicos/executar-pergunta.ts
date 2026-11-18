import "server-only";
import { descreverErro } from "./descrever-erro";
import Anthropic from "@anthropic-ai/sdk";
import { obterClienteAnthropic } from "@/lib/ia/cliente";
import { obterConfiguracaoIa } from "@/lib/ia/configuracao";
import { registrarUsoIa, situacaoLimites } from "@/lib/ia/uso";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { ferramentasDoPapel, paraFerramentaApi } from "../ferramentas/registro";
import type { FerramentaNexu } from "../ferramentas/tipos";
import type { EventoNexu, PropostaVisivel } from "../tipos";
import { anexarMensagens, contarPerguntasNasMensagens, criarConversa, obterConversa, type MensagemParaGravar } from "./conversas";
import { montarPedido, semMensagensVazias, tiraTurnoIncompleto } from "./prompt";

type Uso = Parameters<typeof registrarUsoIa>[0]["usage"];
type EventoStream = Anthropic.Beta.Messages.BetaRawMessageStreamEvent;

/** Separa o texto de rodadas diferentes da API (e os avisos fixos) para não colarem um no outro. */
const SEPARADOR = "\n\n";

export type { EventoNexu } from "../tipos";

export const LIMITE_CHAMADAS_FERRAMENTA = 8;
export const LIMITE_PERGUNTAS_CONVERSA = 30;
const TEMPO_MAXIMO_MS = 60_000;

export const TEXTOS = {
  naoConfigurado: "Nexu ainda não configurado",
  limiteDia: "O limite de perguntas de hoje acabou. Volta amanhã.",
  limiteMes: "O limite do mês foi atingido. Fale com o admin.",
  indisponivel: "O Nexu está indisponível agora, tente de novo em instantes.",
  recusa: "Não consegui responder a isso. Tente reformular.",
  conversaLonga: "Esta conversa ficou longa. Comece uma nova conversa para continuar.",
  respostaCortada: "\n\n_(resposta cortada)_",
  consultaInacabada: "Não consegui terminar a consulta. Tente uma pergunta mais específica.",
} as const;

const ERRO_LIMITE_FERRAMENTAS = "limite de consultas desta pergunta atingido; responda com o que já tem";

/**
 * Resultado de rodar uma ferramenta: o bloco devolvido ao modelo e os eventos extras para a tela
 * (a ferramenta de proposta acrescenta aqui o evento `proposta`).
 */
type ResultadoFerramenta = { bloco: Anthropic.ToolResultBlockParam; eventos: EventoNexu[] };

function blocoDeErro(toolUseId: string, mensagem: string): Anthropic.ToolResultBlockParam {
  return { type: "tool_result", tool_use_id: toolUseId, is_error: true, content: mensagem };
}

function mensagemDeErroDaFerramenta(erro: unknown): string {
  if (erro instanceof ErroPermissao) return "sem permissão para isso";
  if (erro instanceof ErroNegocio) return erro.message;
  return "erro ao consultar os dados";
}

async function rodarFerramenta(
  ferramenta: FerramentaNexu | undefined,
  uso: Anthropic.Beta.Messages.BetaToolUseBlock,
  ator: UsuarioAtual,
  conversaId: string,
): Promise<ResultadoFerramenta> {
  if (!ferramenta) return { bloco: blocoDeErro(uso.id, "ferramenta indisponível"), eventos: [] };
  const entrada = ferramenta.entrada.safeParse(uso.input);
  if (!entrada.success) {
    const problema = entrada.error.issues[0];
    const onde = problema?.path.length ? `${problema.path.join(".")}: ` : "";
    return { bloco: blocoDeErro(uso.id, `entrada inválida: ${onde}${problema?.message ?? ""}`.trim()), eventos: [] };
  }
  try {
    const resultado = await ferramenta.executar(ator, entrada.data, { conversaId, toolUseId: uso.id });
    if (ferramenta.tipo === "proposta") {
      // O modelo recebe só o id e a situação; a tela recebe o cartão da proposta.
      const { proposta } = resultado as { proposta: PropostaVisivel };
      const conteudo = { proposta: proposta.id, situacao: "aguardando confirmação da pessoa" };
      return {
        bloco: { type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(conteudo) },
        eventos: [{ tipo: "proposta", proposta }],
      };
    }
    return { bloco: { type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(resultado ?? null) }, eventos: [] };
  } catch (erro) {
    if (!(erro instanceof ErroPermissao) && !(erro instanceof ErroNegocio)) {
      // Só ids e o tipo do erro: nunca o texto da conversa nem dados da consulta.
      console.error("[nexu] ferramenta falhou", { conversaId, toolUseId: uso.id, ferramenta: ferramenta.nome, erro: descreverErro(erro) });
    }
    return { bloco: blocoDeErro(uso.id, mensagemDeErroDaFerramenta(erro)), eventos: [] };
  }
}

/** Registra o uso sem deixar uma falha do banco esconder o erro original (roda num finally). */
async function registrarUsoSemFalhar(dados: Parameters<typeof registrarUsoIa>[0]): Promise<void> {
  try {
    await registrarUsoIa(dados);
  } catch (erro) {
    console.error("[nexu] falha ao registrar uso", { usuarioId: dados.usuarioId, erro: descreverErro(erro) });
  }
}

/** Só a contagem e os motivos (enum da API) dos blocos de thinking descartados; nunca o conteúdo. */
function avisarBlocosDescartados(
  transformacoes: Anthropic.Beta.Messages.BetaInputTransformation[] | null | undefined,
  conversaId: string | null,
) {
  const descartados = (transformacoes ?? []).filter((t) => t.type === "thinking_dropped");
  if (descartados.length === 0) return;
  const motivos = [...new Set(descartados.map((t) => t.reason))];
  console.warn("[nexu] blocos de thinking descartados", { conversaId, quantidade: descartados.length, motivos });
}

/**
 * Roda uma pergunta ao Nexu: checa limites, chama a API com as ferramentas do papel (loop de tool use),
 * grava a conversa e o uso, e emite eventos para a tela. As ferramentas rodam como a pessoa logada.
 */
export async function* executarPergunta(e: {
  ator: UsuarioAtual;
  conversaId: string | null;
  pergunta: string;
  tela: string | null;
  cliente?: Anthropic;
  agora?: Date;
  /** Sinal da requisição HTTP: a pessoa saiu da página/fechou a aba. Corta a chamada à API. */
  sinal?: AbortSignal;
}): AsyncGenerator<EventoNexu> {
  const { ator, pergunta } = e;
  const cliente = e.cliente ?? obterClienteAnthropic();
  if (!cliente) {
    yield { tipo: "erro", mensagem: TEXTOS.naoConfigurado };
    return;
  }
  const agora = e.agora ?? new Date();

  const limites = await situacaoLimites(ator.id, agora);
  if (!limites.ok) {
    yield { tipo: "texto", texto: limites.motivo === "dia" ? TEXTOS.limiteDia : TEXTOS.limiteMes };
    yield { tipo: "fim", restantesHoje: 0 };
    return;
  }

  let conversaId = e.conversaId;
  let historico: Anthropic.MessageParam[] = [];
  if (conversaId) {
    let conversa: Awaited<ReturnType<typeof obterConversa>>;
    try {
      conversa = await obterConversa(ator, conversaId);
    } catch (erro) {
      if (erro instanceof ErroNegocio) {
        yield { tipo: "erro", mensagem: erro.message };
        return;
      }
      throw erro;
    }
    if (contarPerguntasNasMensagens(conversa.mensagens) >= LIMITE_PERGUNTAS_CONVERSA) {
      yield { tipo: "texto", texto: TEXTOS.conversaLonga };
      yield { tipo: "fim", restantesHoje: limites.restantesHoje };
      return;
    }
    historico = tiraTurnoIncompleto(
      semMensagensVazias(
        conversa.mensagens.map((m) => ({
          role: m.papel === "usuario" ? "user" : "assistant",
          content: m.conteudo as unknown as Anthropic.ContentBlockParam[],
        })),
      ),
    );
  }

  const { modelo } = await obterConfiguracaoIa();
  const ferramentas = ferramentasDoPapel(ator.papel);
  const porNome = new Map(ferramentas.map((f) => [f.nome, f]));
  const pedido = montarPedido({
    modelo,
    ferramentas: ferramentas.map(paraFerramentaApi),
    historico,
    contexto: { agora, nome: ator.nome, papel: ator.papel, tela: e.tela },
    pergunta,
  });
  const mensagens = [...pedido.messages];
  const mensagemPergunta = mensagens[mensagens.length - 1];

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_MAXIMO_MS);
  const cortar = () => controle.abort();
  if (e.sinal?.aborted) controle.abort();
  else e.sinal?.addEventListener("abort", cortar, { once: true });
  let primeira = true;
  let chamadas = 0;
  let encerrando = false;
  let houveTexto = false;
  const comSeparador = (texto: string) => (houveTexto ? SEPARADOR + texto : texto);

  try {
    for (;;) {
      // Uso desta chamada, somado pelos eventos do stream: vale também se ela for cortada no meio
      // (timeout, "Nova conversa", aba fechada, erro). A Anthropic cobra o que já foi gerado.
      const inicioPergunta = primeira;
      let usoChamada: Uso | null = null;
      let resposta: Anthropic.Beta.Messages.BetaMessage;
      try {
        const stream = cliente.beta.messages.stream({ ...pedido, messages: mensagens }, { signal: controle.signal });
        let textoNaRodada = false;
        for await (const evento of stream as AsyncIterable<EventoStream>) {
          if (evento.type === "message_start") {
            usoChamada = { ...evento.message.usage };
            avisarBlocosDescartados(evento.message.input_transformations, conversaId);
          } else if (evento.type === "message_delta" && usoChamada) {
            // Os números do message_delta são acumulados; input/cache podem vir null.
            usoChamada = {
              input_tokens: evento.usage.input_tokens ?? usoChamada.input_tokens,
              output_tokens: evento.usage.output_tokens ?? usoChamada.output_tokens,
              cache_creation_input_tokens: evento.usage.cache_creation_input_tokens ?? usoChamada.cache_creation_input_tokens,
              cache_read_input_tokens: evento.usage.cache_read_input_tokens ?? usoChamada.cache_read_input_tokens,
            };
          } else if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") {
            const texto = textoNaRodada ? evento.delta.text : comSeparador(evento.delta.text);
            textoNaRodada = true;
            houveTexto = true;
            yield { tipo: "texto", texto };
          }
        }
        resposta = await stream.finalMessage();
        usoChamada = resposta.usage;
      } finally {
        // Exatamente um UsoIa por chamada à API que chegou a começar (recebeu message_start).
        if (usoChamada) await registrarUsoSemFalhar({ origem: "nexu", usuarioId: ator.id, modelo, inicioPergunta, usage: usoChamada });
      }

      if (!conversaId) {
        conversaId = (await criarConversa(ator, pergunta)).id;
        yield { tipo: "conversa", conversaId };
      }
      // A pergunta só é gravada depois que a 1ª resposta chega, junto com ela. O assistente vai sem alterações;
      // um assistente com tool_use só é gravado junto com os seus tool_result (nunca fica turno pendente no banco).
      const lote: MensagemParaGravar[] = primeira
        ? [{ papel: "usuario", conteudo: mensagemPergunta.content as Anthropic.TextBlockParam[] }]
        : [];
      primeira = false;
      // Conteúdo vazio (ex.: refusal sem texto) não é gravado nem reenviado: a API recusa assistente vazio no meio do histórico.
      if (resposta.content.length > 0) {
        lote.push({ papel: "assistente", conteudo: resposta.content });
        mensagens.push({ role: "assistant", content: resposta.content as unknown as Anthropic.Beta.Messages.BetaContentBlockParam[] });
      }

      if (resposta.stop_reason !== "tool_use") {
        await anexarMensagens(conversaId, lote);
        if (resposta.stop_reason === "refusal") yield { tipo: "texto", texto: comSeparador(TEXTOS.recusa) };
        if (resposta.stop_reason === "max_tokens") yield { tipo: "texto", texto: TEXTOS.respostaCortada };
        break;
      }

      const usos = resposta.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
      const restantes = encerrando ? 0 : Math.max(0, LIMITE_CHAMADAS_FERRAMENTA - chamadas);
      const aExecutar = usos.slice(0, restantes);
      const excedentes = usos.slice(restantes);
      chamadas += aExecutar.length;

      for (const uso of aExecutar) {
        const f = porNome.get(uso.name);
        if (f) yield { tipo: "consultando", rotulo: f.rotulo };
      }
      const idConversa = conversaId;
      const executados = await Promise.all(aExecutar.map((uso) => rodarFerramenta(porNome.get(uso.name), uso, ator, idConversa)));

      const blocos = [...executados.map((r) => r.bloco), ...excedentes.map((u) => blocoDeErro(u.id, ERRO_LIMITE_FERRAMENTAS))];
      lote.push({ papel: "usuario", conteudo: blocos });
      mensagens.push({ role: "user", content: blocos });
      await anexarMensagens(conversaId, lote);
      for (const r of executados) for (const ev of r.eventos) yield ev;

      // Passou do limite: uma última chamada para a resposta final. Se ela ainda pedir ferramenta, para aqui com um aviso.
      if (encerrando) {
        yield { tipo: "texto", texto: comSeparador(TEXTOS.consultaInacabada) };
        break;
      }
      if (excedentes.length > 0) encerrando = true;
    }
  } catch (erro) {
    console.error("[nexu] pergunta falhou", {
      usuarioId: ator.id,
      conversaId,
      erro: descreverErro(erro),
      status: erro instanceof Anthropic.APIError ? erro.status : undefined,
    });
    yield { tipo: "erro", mensagem: TEXTOS.indisponivel };
    return;
  } finally {
    // Também cobre a tela que desistiu no meio (o gerador é encerrado): corta a chamada em andamento.
    clearTimeout(relogio);
    e.sinal?.removeEventListener("abort", cortar);
    controle.abort();
  }

  const depois = await situacaoLimites(ator.id, e.agora ?? new Date());
  yield { tipo: "fim", restantesHoje: depois.ok ? depois.restantesHoje : 0 };
}
