import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { calcularIndicadores } from "../regras/indicadores";
import { inicioDaSemanaSaoPaulo } from "../regras/semana";
import type { IndicadorConcorrente } from "../regras/tipos";

const SEMANA_MS = 7 * 86_400_000;

function exigirVer(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "espiao:ver")) throw new ErroPermissao("espiao:ver");
}

/** "AAAA-MM-DD" da segunda-feira (São Paulo) da semana de `d`. */
const chaveSemana = (d: Date) => diaEmSaoPaulo(inicioDaSemanaSaoPaulo(d));

export type SinalTela = {
  id: string;
  concorrenteId: string;
  concorrente: string;
  tipo: string;
  titulo: string;
  detalhe: Record<string, unknown>;
  origemUrl: string | null;
  criadoEm: Date;
};

const SELECAO_SINAL = { id: true, concorrenteId: true, tipo: true, titulo: true, detalhe: true, origemUrl: true, criadoEm: true, concorrente: { select: { nome: true } } } as const;
type SinalBanco = { id: string; concorrenteId: string; tipo: string; titulo: string; detalhe: unknown; origemUrl: string | null; criadoEm: Date; concorrente: { nome: string } };
const paraSinal = (s: SinalBanco): SinalTela => ({ ...s, concorrente: s.concorrente.nome, detalhe: (s.detalhe ?? {}) as Record<string, unknown> });

export async function visaoSemana(ator: UsuarioAtual, semana?: string, agora: Date = new Date()) {
  exigirVer(ator);
  const coletas = await prisma.coletaEspiao.findMany({ orderBy: { iniciadaEm: "desc" }, take: 120, select: { id: true, status: true, iniciadaEm: true, finalizadaEm: true } });
  const semanasDisponiveis = [...new Set(coletas.map((c) => chaveSemana(c.iniciadaEm)))];
  const escolhida = semana && semanasDisponiveis.includes(semana) ? semana : (semanasDisponiveis[0] ?? chaveSemana(agora));
  const daSemana = coletas.filter((c) => chaveSemana(c.iniciadaEm) === escolhida);
  const ids = daSemana.map((c) => c.id);

  const [sinais, relatorio, concorrentes] = await Promise.all([
    ids.length
      ? prisma.sinalEspiao.findMany({ where: { coletaId: { in: ids } }, orderBy: { criadoEm: "desc" }, select: SELECAO_SINAL })
      : Promise.resolve([]),
    ids.length
      ? prisma.relatorioEspiao.findFirst({ where: { coletaId: { in: ids } }, orderBy: { coleta: { iniciadaEm: "desc" } }, select: { analise: true } })
      : Promise.resolve(null),
    prisma.concorrente.findMany({
      where: { ativo: true, excluidoEm: null },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        instagram: true,
        fotos: { orderBy: { capturadaEm: "desc" }, take: 12, select: { seguidores: true, capturadaEm: true } },
        midias: { orderBy: { publicadoEm: "desc" }, take: 60, select: { publicadoEm: true, curtidas: true, comentarios: true } },
      },
    }),
  ]);
  const sinaisTela = (sinais as SinalBanco[]).map(paraSinal);
  const fimDaSemana = new Date(new Date(`${escolhida}T03:00:00.000Z`).getTime() + SEMANA_MS);
  const referencia = fimDaSemana < agora ? fimDaSemana : agora;
  const indicadores: (IndicadorConcorrente & { concorrenteId: string })[] = concorrentes.map((c) => ({
    concorrenteId: c.id,
    ...calcularIndicadores({
      concorrente: c.nome,
      fotos: c.fotos.filter((f) => f.capturadaEm <= referencia),
      midias: c.midias,
      destaques: sinaisTela.filter((s) => s.concorrenteId === c.id && s.tipo === "conteudo_destaque").map((s) => s.titulo),
      agora: referencia,
    }),
  }));
  return { semana: escolhida, semanasDisponiveis, ultimaColeta: daSemana[0] ?? null, sinais: sinaisTela, indicadores, analise: relatorio?.analise ?? null };
}
export type VisaoSemana = Awaited<ReturnType<typeof visaoSemana>>;

export async function visaoConcorrente(ator: UsuarioAtual, id: string) {
  exigirVer(ator);
  const c = await prisma.concorrente.findFirst({
    where: { id, excluidoEm: null },
    select: {
      id: true,
      nome: true,
      instagram: true,
      site: true,
      fotos: { orderBy: { capturadaEm: "desc" }, take: 26, select: { seguidores: true, totalPosts: true, capturadaEm: true } },
      midias: {
        orderBy: { publicadoEm: "desc" },
        take: 30,
        select: { id: true, tipo: true, legenda: true, permalink: true, publicadoEm: true, curtidas: true, comentarios: true, visualizacoes: true, transcricao: true, resumo: true, situacaoTranscricao: true },
      },
      paginas: {
        where: { excluidoEm: null },
        orderBy: { rotulo: "asc" },
        select: { id: true, url: true, rotulo: true, legivel: true, ultimaCapturaEm: true, versoes: { orderBy: { capturadaEm: "desc" }, take: 10, select: { id: true, precos: true, capturadaEm: true } } },
      },
      sinais: { orderBy: { criadoEm: "desc" }, take: 50, select: SELECAO_SINAL },
    },
  });
  if (!c) throw new ErroNegocio("Concorrente não encontrado.");
  return { ...c, sinais: (c.sinais as SinalBanco[]).map(paraSinal), paginas: c.paginas.map((p) => ({ ...p, versoes: p.versoes.map((v) => ({ ...v, precos: Array.isArray(v.precos) ? (v.precos as string[]) : [] })) })) };
}
export type VisaoConcorrente = Awaited<ReturnType<typeof visaoConcorrente>>;

/** Sinais novos desde a última visita ao Espião (sem visita: os da semana atual). */
export async function contarSinaisNovos(usuarioId: string, agora: Date = new Date()): Promise<number> {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { espiaoVistoEm: true } });
  const desde = u?.espiaoVistoEm ?? inicioDaSemanaSaoPaulo(agora);
  return prisma.sinalEspiao.count({ where: { criadoEm: { gt: desde } } });
}

export async function marcarEspiaoVisto(usuarioId: string): Promise<void> {
  await prisma.usuario.update({ where: { id: usuarioId }, data: { espiaoVistoEm: new Date() } });
}
