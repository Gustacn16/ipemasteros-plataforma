import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import { mascararUrl, validarUrlIcal } from "../regras/url-ical";
import { exigir } from "./acesso";
import { cifrar, decifrar } from "./cifra";
import { buscarIcal, esquecerAgendaExterna, interpretarIcalIsolado, lerAgendaExterna, type EventoExterno } from "./ical-externo";

/**
 * Agendas pessoais por link iCal (spec, regras 5 e 6). Só o dono lê, edita ou remove:
 * toda consulta filtra por `usuarioId = ator.id`, inclusive para admin.
 * Nunca registra em log nem grava no banco a URL em claro ou os eventos.
 */

export const LIMITE_AGENDAS = 5;
const NAO_ENCONTRADO = "Não encontrado.";
const ERRO_GENERICO = "Não consegui ler esta agenda.";
const MAX_ERRO = 200;
/** Um sucesso só é regravado se o último tiver mais que isto (o mesmo prazo do cache). */
const REGRAVAR_SUCESSO_MS = 10 * 60 * 1000;

export type MinhaAgenda = {
  id: string;
  nome: string;
  cor: string;
  urlMascarada: string;
  ultimoSucessoEm: Date | null;
  ultimoErro: string | null;
};

export type EventoDeAgenda = EventoExterno & { agendaId: string };

function mascararCifrada(urlCifrada: string): string {
  try {
    return mascararUrl(decifrar(urlCifrada));
  } catch {
    return "link ilegível, cole de novo";
  }
}

/** Só nossas mensagens curtas vão para a tela e para `ultimoErro`; nunca o texto de um erro inesperado. */
function mensagemDeErro(e: unknown): string {
  return e instanceof ErroNegocio ? e.message.slice(0, MAX_ERRO) : ERRO_GENERICO;
}

export async function listarMinhasAgendas(ator: UsuarioAtual): Promise<MinhaAgenda[]> {
  exigir(ator, "agenda:usar");
  const linhas = await prisma.agendaExterna.findMany({
    where: { usuarioId: ator.id },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, cor: true, urlCifrada: true, ultimoSucessoEm: true, ultimoErro: true },
  });
  return linhas.map(({ urlCifrada, ...resto }) => ({ ...resto, urlMascarada: mascararCifrada(urlCifrada) }));
}

/** Testa a leitura antes de salvar: se não ler, não salva e explica o motivo. */
export async function adicionarAgenda(
  ator: UsuarioAtual,
  dados: { nome: string; cor: string; url: string },
): Promise<{ id: string }> {
  exigir(ator, "agenda:usar");
  const validada = validarUrlIcal(dados.url);
  if (!validada.ok) throw new ErroNegocio(validada.mensagem);
  const url = validada.url.href;

  const limiteAtingido = async () =>
    (await prisma.agendaExterna.count({ where: { usuarioId: ator.id } })) >= LIMITE_AGENDAS;
  if (await limiteAtingido()) throw new ErroNegocio(`Você já tem ${LIMITE_AGENDAS} agendas ligadas.`);

  const hoje = diaEmSaoPaulo(new Date());
  const texto = await buscarIcal(url);
  await interpretarIcalIsolado(texto, somarDias(hoje, -30), somarDias(hoje, 90));

  // Confere de novo depois da busca (que pode levar segundos).
  if (await limiteAtingido()) throw new ErroNegocio(`Você já tem ${LIMITE_AGENDAS} agendas ligadas.`);
  const criada = await prisma.agendaExterna.create({
    data: {
      usuarioId: ator.id,
      nome: dados.nome,
      cor: dados.cor,
      urlCifrada: cifrar(url),
      ultimoSucessoEm: new Date(),
    },
    select: { id: true },
  });
  return criada;
}

export async function editarAgenda(ator: UsuarioAtual, id: string, dados: { nome: string; cor: string }): Promise<void> {
  exigir(ator, "agenda:usar");
  const { count } = await prisma.agendaExterna.updateMany({
    where: { id, usuarioId: ator.id },
    data: { nome: dados.nome, cor: dados.cor },
  });
  if (count === 0) throw new ErroNegocio(NAO_ENCONTRADO);
  esquecerAgendaExterna(id);
}

export async function removerAgenda(ator: UsuarioAtual, id: string): Promise<void> {
  exigir(ator, "agenda:usar");
  const { count } = await prisma.agendaExterna.deleteMany({ where: { id, usuarioId: ator.id } });
  if (count === 0) throw new ErroNegocio(NAO_ENCONTRADO);
  esquecerAgendaExterna(id);
}

/**
 * Lê em paralelo as agendas ligadas do ator. Uma falha vira aviso da agenda (`erro`)
 * e não derruba as outras. O estado (`ultimoSucessoEm`/`ultimoErro`) só é gravado quando muda.
 */
export async function eventosDasMinhasAgendas(
  ator: UsuarioAtual,
  de: string,
  ate: string,
  desligadas: string[],
): Promise<{ agendas: { id: string; nome: string; cor: string; erro: string | null }[]; eventos: EventoDeAgenda[] }> {
  exigir(ator, "agenda:usar");
  const linhas = await prisma.agendaExterna.findMany({
    where: { usuarioId: ator.id },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, cor: true, urlCifrada: true, ultimoSucessoEm: true, ultimoErro: true },
  });
  const fora = new Set(desligadas);

  const resultados = await Promise.all(
    linhas.map(async (a) => {
      if (fora.has(a.id)) return { erro: null, eventos: [] as EventoDeAgenda[] };
      try {
        const lidos = await lerAgendaExterna(a.id, decifrar(a.urlCifrada), de, ate);
        const agora = new Date();
        const velho = !a.ultimoSucessoEm || agora.getTime() - a.ultimoSucessoEm.getTime() > REGRAVAR_SUCESSO_MS;
        if (a.ultimoErro !== null || velho) await gravarEstado(ator.id, a.id, { ultimoSucessoEm: agora, ultimoErro: null });
        return { erro: null, eventos: lidos.map((e) => ({ ...e, agendaId: a.id })) };
      } catch (e) {
        const erro = mensagemDeErro(e);
        if (a.ultimoErro !== erro) await gravarEstado(ator.id, a.id, { ultimoErro: erro });
        return { erro, eventos: [] as EventoDeAgenda[] };
      }
    }),
  );

  return {
    agendas: linhas.map((a, i) => ({ id: a.id, nome: a.nome, cor: a.cor, erro: resultados[i].erro })),
    eventos: resultados.flatMap((r) => r.eventos),
  };
}

/** Falha ao gravar o estado não impede de mostrar a agenda. Nada vai para o log. */
async function gravarEstado(
  usuarioId: string,
  id: string,
  data: { ultimoSucessoEm?: Date; ultimoErro: string | null },
): Promise<void> {
  await prisma.agendaExterna.updateMany({ where: { id, usuarioId }, data }).catch(() => {});
}
