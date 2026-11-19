import "server-only";
import type { TimeNumeroWhatsapp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { eventosDaConversa, mediana, percentual, type MensagemTempo } from "../regras/atendimento";
import type { Semana } from "../regras/dia";
import { temFollowup } from "../regras/time";
import { obterRegrasAtendimento } from "./configuracao";

const ESCOPO = "whatsapp:ver_equipe";
const JANELA_AO_VIVO_MS = 30 * 86_400_000;
const LOTE_CONVERSAS = 1000;

export type LinhaAtendimento = {
  numeroId: string;
  nome: string;
  dono: string | null;
  time: TimeNumeroWhatsapp;
  conversas: number;
  primeiraRespostaSeg: number | null;
  respostaSeg: number | null;
  noSlaPct: number | null;
  followupPct: number | null;
  semRespostaAgora: number;
};

export type PontoEvolucao = {
  rotulo: string;
  primeiraRespostaMin: number | null;
  respostaMin: number | null;
  noSlaPct: number | null;
  followupPct: number | null;
};

export type ItemSemResposta = {
  conversaId: string;
  numeroId: string;
  numeroNome: string;
  contatoNome: string;
  desde: Date;
  segundos: number;
};

type LinhaDiaria = {
  numeroId: string;
  dia: Date;
  conversasComCliente: number;
  primeirasRespostasSeg: unknown;
  respostasSeg: unknown;
  respostasNoSla: number;
  semResposta: number;
  followupsFeitos: number;
  followupsPerdidos: number;
};

function exigirPermissao(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, ESCOPO)) throw new ErroPermissao(ESCOPO);
}

/** Meia-noite UTC da data de São Paulo, como as linhas @db.Date guardam. */
const diaDb = (dia: string) => new Date(`${dia}T00:00:00.000Z`);

const lista = (valor: unknown): number[] => (Array.isArray(valor) ? valor.filter((v): v is number => typeof v === "number") : []);

/** Junta as listas das linhas diárias antes da mediana; o % no SLA conta as vezes sem resposta no total. */
function agregar(linhas: LinhaDiaria[]) {
  const primeiras = linhas.flatMap((l) => lista(l.primeirasRespostasSeg));
  const respostas = linhas.flatMap((l) => lista(l.respostasSeg));
  const soma = (f: (l: LinhaDiaria) => number) => linhas.reduce((t, l) => t + f(l), 0);
  const feitos = soma((l) => l.followupsFeitos);
  return {
    conversas: soma((l) => l.conversasComCliente),
    primeiraRespostaSeg: mediana(primeiras),
    respostaSeg: mediana(respostas),
    noSlaPct: percentual(soma((l) => l.respostasNoSla), respostas.length + soma((l) => l.semResposta)),
    followupPct: percentual(feitos, feitos + soma((l) => l.followupsPerdidos)),
  };
}

const linhasDaSemana = (where: { numeroId?: string }, inicio: string, fim: string) =>
  prisma.metricaAtendimentoDia.findMany({ where: { ...where, dia: { gte: diaDb(inicio), lt: diaDb(fim) } } });

/** Uma linha por número não excluído com as métricas da semana e a contagem ao vivo de "sem resposta". */
export async function resumoDaSemana(
  ator: UsuarioAtual,
  semana: Semana,
  opcoes: { agora?: Date; semResposta?: ItemSemResposta[] } = {},
): Promise<LinhaAtendimento[]> {
  exigirPermissao(ator);
  const [numeros, linhas, aoVivo] = await Promise.all([
    prisma.numeroWhatsapp.findMany({
      where: { excluidoEm: null },
      select: { id: true, nome: true, time: true, usuario: { select: { nome: true, apelido: true } } },
      orderBy: { nome: "asc" },
    }),
    linhasDaSemana({}, semana.texto, somarDias(semana.texto, 7)),
    opcoes.semResposta ?? semRespostaAgora(ator, opcoes.agora),
  ]);
  const porNumero = new Map<string, LinhaDiaria[]>();
  for (const l of linhas) porNumero.set(l.numeroId, [...(porNumero.get(l.numeroId) ?? []), l]);
  return numeros.map((n) => {
    const a = agregar(porNumero.get(n.id) ?? []);
    return {
      numeroId: n.id,
      nome: n.nome,
      dono: n.usuario ? (n.usuario.apelido ?? n.usuario.nome) : null,
      time: n.time,
      ...a,
      // Follow-up só vale nos times de venda (pelo time atual do número).
      followupPct: temFollowup(n.time) ? a.followupPct : null,
      semRespostaAgora: aoVivo.filter((i) => i.numeroId === n.id).length,
    };
  });
}

const emMinutos = (seg: number | null) => (seg === null ? null : Math.round(seg / 6) / 10);

/**
 * Para cada semana (da lista, em ordem), os tempos em minutos e os percentuais; null onde não há dado.
 * O follow-up fica null em todas as semanas quando o time atual do número não é de venda.
 */
export async function evolucaoDoNumero(ator: UsuarioAtual, numeroId: string, semanas: Semana[]): Promise<PontoEvolucao[]> {
  exigirPermissao(ator);
  if (semanas.length === 0) return [];
  const textos = semanas.map((s) => s.texto).sort();
  const [numeros, linhas] = await Promise.all([
    prisma.numeroWhatsapp.findMany({ where: { id: numeroId }, select: { time: true } }),
    linhasDaSemana({ numeroId }, textos[0]!, somarDias(textos[textos.length - 1]!, 7)),
  ]);
  const comFollowup = numeros[0] ? temFollowup(numeros[0].time) : false;
  return semanas.map((s) => {
    const fim = somarDias(s.texto, 7);
    const daSemana = linhas.filter((l) => l.dia >= diaDb(s.texto) && l.dia < diaDb(fim));
    const a = agregar(daSemana);
    return {
      rotulo: s.rotulo,
      primeiraRespostaMin: emMinutos(a.primeiraRespostaSeg),
      respostaMin: emMinutos(a.respostaSeg),
      noSlaPct: a.noSlaPct,
      followupPct: comFollowup ? a.followupPct : null,
    };
  });
}

/**
 * Conversas `lead`/`aluno` cuja última vez do cliente está aberta e já passou do SLA, da maior espera para a menor.
 * Lê só as conversas com mensagem nos últimos 30 dias; mensagens em lote, nunca uma consulta por conversa.
 */
export async function semRespostaAgora(ator: UsuarioAtual, agora: Date = new Date()): Promise<ItemSemResposta[]> {
  exigirPermissao(ator);
  const desde = new Date(agora.getTime() - JANELA_AO_VIVO_MS);
  const conversas = await prisma.conversaWhatsapp.findMany({
    where: {
      tipo: "individual",
      categoria: { in: ["lead", "aluno"] },
      numero: { excluidoEm: null },
      ultimaMensagemEm: { gte: desde },
    },
    select: { id: true, nome: true, numeroId: true, contato: { select: { nomeExibido: true } }, numero: { select: { nome: true } } },
  });
  if (conversas.length === 0) return [];

  const regras = await obterRegrasAtendimento();
  const porConversa = new Map<string, MensagemTempo[]>();
  for (let i = 0; i < conversas.length; i += LOTE_CONVERSAS) {
    const mensagens = await prisma.mensagemWhatsapp.findMany({
      where: { conversaId: { in: conversas.slice(i, i + LOTE_CONVERSAS).map((c) => c.id) }, enviadaEm: { gte: desde } },
      select: { conversaId: true, deMim: true, enviadaEm: true },
      orderBy: [{ enviadaEm: "asc" }, { id: "asc" }],
    });
    for (const m of mensagens) {
      const doConversa = porConversa.get(m.conversaId) ?? [];
      doConversa.push({ deMim: m.deMim, enviadaEm: m.enviadaEm });
      porConversa.set(m.conversaId, doConversa);
    }
  }

  const sla = regras.slaMinutos * 60;
  const itens: ItemSemResposta[] = [];
  for (const c of conversas) {
    const mensagens = porConversa.get(c.id);
    if (!mensagens?.length || !c.numeroId) continue;
    // Conversas e mensagens usam a mesma janela de 30 dias: assim uma conversa cuja última mensagem
    // tem, por exemplo, 10 dias ainda tem as mensagens dela. Uma espera que começou antes da janela
    // conta a partir da primeira mensagem do cliente dentro dela (e `desde` mostra esse instante).
    const { vezes } = eventosDaConversa(mensagens, agora, regras);
    const ultima = vezes[vezes.length - 1];
    if (!ultima || ultima.respondidaEm || ultima.segundos <= sla) continue;
    itens.push({
      conversaId: c.id,
      numeroId: c.numeroId,
      numeroNome: c.numero?.nome ?? "—",
      contatoNome: c.contato?.nomeExibido ?? c.nome ?? "Sem nome",
      desde: ultima.inicio,
      segundos: ultima.segundos,
    });
  }
  return itens.sort((a, b) => b.segundos - a.segundos || a.desde.getTime() - b.desde.getTime());
}
