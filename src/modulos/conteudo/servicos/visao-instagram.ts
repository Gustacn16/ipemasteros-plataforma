import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import { inicioDoDiaSaoPaulo } from "@/modulos/tarefas/regras/relatorio";
import type { FiltroConteudo } from "../esquemas/conteudo";
import { proximoMes } from "../regras/calendario";
import { type NumerosConta, type OrdemMidia, alcanceAproximado, diasFechados, ordenarMidias, relatorioDoMes } from "../regras/instagram";

function exigirUso(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "conteudo:usar")) throw new ErroPermissao("conteudo:usar");
}

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const mesAnterior = (mes: string) => somarDias(`${mes}-01`, -1).slice(0, 7);
/** Instantes de início e fim (exclusivo) do mês "AAAA-MM" em São Paulo. */
const limitesDoMes = (mes: string) => ({ gte: inicioDoDiaSaoPaulo(`${mes}-01`), lt: inicioDoDiaSaoPaulo(`${proximoMes(mes)}-01`) });

/** Contas do Instagram ligadas a um canal que entra no filtro de conta e canal. */
const contasDoFiltroWhere = (f: FiltroConteudo): Prisma.ContaInstagramWhereInput => ({
  ativa: true,
  canal: { ativo: true, excluidoEm: null, ...(f.marca ? { marcaId: f.marca } : {}), ...(f.canal ? { id: f.canal } : {}) },
});

export async function contasDoFiltro(f: FiltroConteudo) {
  return prisma.contaInstagram.findMany({ where: contasDoFiltroWhere(f), select: { id: true, canalId: true } });
}

/** Soma campo a campo; `null` só quando nenhuma conta informou. */
function somar(linhas: Partial<Record<keyof NumerosConta, number | null>>[]): NumerosConta | null {
  if (linhas.length === 0) return null;
  const campos: (keyof NumerosConta)[] = [
    "alcance",
    "visualizacoes",
    "interacoes",
    "curtidas",
    "comentarios",
    "salvamentos",
    "compartilhamentos",
    "cliquesLink",
    "novosSeguidores",
    "deixaramDeSeguir",
  ];
  const total = {} as NumerosConta;
  for (const c of campos) {
    const valores = linhas.map((l) => l[c]).filter((v): v is number => typeof v === "number");
    total[c] = valores.length ? valores.reduce((s, v) => s + v, 0) : null;
  }
  return total;
}

/** Último total de seguidores anotado até o fim do mês, por conta. */
async function seguidoresAte(contaIds: string[], mes: string): Promise<Map<string, number>> {
  const total = new Map<string, number>();
  for (const contaId of contaIds) {
    const linha = await prisma.metricaContaInstagram.findFirst({
      where: { contaId, periodo: "dia", seguidores: { not: null }, data: { lt: dataDoDia(`${proximoMes(mes)}-01`) } },
      orderBy: { data: "desc" },
      select: { seguidores: true },
    });
    if (linha?.seguidores != null) total.set(contaId, linha.seguidores);
  }
  return total;
}

/** Visitas ao perfil vindas dos posts e stories publicados entre `desde` e `ate` (dias de São Paulo, `ate` exclusivo). */
async function visitasPerfil(contaIds: string[], desde: string, ate: string): Promise<number | null> {
  const r = await prisma.midiaInstagram.aggregate({
    where: { contaId: { in: contaIds }, removidaEm: null, publicadoEm: { gte: inicioDoDiaSaoPaulo(desde), lt: inicioDoDiaSaoPaulo(ate) } },
    _sum: { visitasPerfil: true },
  });
  return r._sum.visitasPerfil;
}

/** Contas do Instagram ligadas a um canal do filtro, com o total de seguidores mais recente. */
async function contasDoRelatorio(f: FiltroConteudo, mes: string) {
  const contas = await prisma.contaInstagram.findMany({
    where: contasDoFiltroWhere(f),
    orderBy: { usuario: "asc" },
    select: { id: true, usuario: true, nome: true, fotoUrl: true, canal: { select: { marca: { select: { nome: true, cor: true } } } } },
  });
  const seguidores = await seguidoresAte(
    contas.map((c) => c.id),
    mes,
  );
  return contas.map((c) => ({ ...c, seguidores: seguidores.get(c.id) ?? null }));
}

/**
 * Aba Relatórios: contas conectadas e números do mês da conta escolhida (ou de todas).
 * `null` quando nenhuma conta do filtro tem Instagram ligado.
 */
export async function relatorioInstagram(ator: UsuarioAtual, f: FiltroConteudo, mes: string, contaEscolhida?: string) {
  exigirUso(ator);
  const contas = await contasDoRelatorio(f, mes);
  if (contas.length === 0) return null;
  const conta = contas.find((c) => c.id === contaEscolhida) ?? null;
  const ids = conta ? [conta.id] : contas.map((c) => c.id);
  const hoje = diaEmSaoPaulo(new Date());
  const anterior = mesAnterior(mes);
  const dias = diasFechados(mes, hoje);
  const parcial = dias !== null;
  // No mês em andamento, compara com os mesmos dias do mês anterior (sem passar do fim dele).
  const fimComparacao = parcial ? [somarDias(`${anterior}-01`, dias), `${mes}-01`].sort()[0]! : `${mes}-01`;

  const [atual, diasAnteriores, mesPassado, porDia, visitas, visitasAnterior, midias, ultima] = await Promise.all([
    prisma.metricaContaInstagram.findMany({ where: { contaId: { in: ids }, periodo: "mes", data: dataDoDia(`${mes}-01`) } }),
    parcial
      ? prisma.metricaContaInstagram.findMany({
          where: { contaId: { in: ids }, periodo: "dia", data: { gte: dataDoDia(`${anterior}-01`), lt: dataDoDia(fimComparacao) } },
        })
      : Promise.resolve([]),
    parcial
      ? Promise.resolve([])
      : prisma.metricaContaInstagram.findMany({ where: { contaId: { in: ids }, periodo: "mes", data: dataDoDia(`${anterior}-01`) } }),
    prisma.metricaContaInstagram.findMany({
      where: { contaId: { in: ids }, periodo: "dia", data: { gte: dataDoDia(`${mes}-01`), lt: dataDoDia(`${proximoMes(mes)}-01`) } },
      orderBy: { data: "asc" },
      select: { data: true, alcance: true, visualizacoes: true, seguidores: true },
    }),
    visitasPerfil(ids, `${mes}-01`, parcial ? somarDias(`${mes}-01`, dias) : `${proximoMes(mes)}-01`),
    visitasPerfil(ids, `${anterior}-01`, fimComparacao),
    midiasDasContas(ids, mes),
    prisma.atualizacaoInstagram.findFirst({
      where: { tipo: "completa", status: "concluida" },
      orderBy: { finalizadoEm: "desc" },
      select: { finalizadoEm: true },
    }),
  ]);

  type Dia = { data: string; alcance: number | null; visualizacoes: number | null; seguidores: number | null };
  const soma = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);
  const serie = new Map<string, Dia>();
  for (const l of porDia) {
    const data = l.data.toISOString().slice(0, 10);
    const d = serie.get(data) ?? { data, alcance: null, visualizacoes: null, seguidores: null };
    d.alcance = soma(d.alcance, l.alcance);
    d.visualizacoes = soma(d.visualizacoes, l.visualizacoes);
    d.seguidores = soma(d.seguidores, l.seguidores);
    serie.set(data, d);
  }
  const seguidores = ids.some((id) => contas.find((c) => c.id === id)?.seguidores !== null)
    ? ids.reduce((t, id) => t + (contas.find((c) => c.id === id)?.seguidores ?? 0), 0)
    : null;

  return {
    contas,
    contaId: conta?.id ?? null,
    parcial,
    diasComparados: dias,
    cartoes: relatorioDoMes({
      mes: somar(atual),
      comparacao: somar(parcial ? diasAnteriores : mesPassado),
      parcial,
      seguidores,
      visitasPerfil: visitas,
      visitasPerfilAnterior: visitasAnterior,
    }),
    // A Meta só dá o alcance de 30 dias: num mês de 31 já fechado, o número é aproximado.
    alcanceAproximado: alcanceAproximado(mes, hoje),
    porDia: [...serie.values()],
    maisAlcance: ordenarMidias(midias, "alcance").slice(0, 5),
    atualizadoEm: ultima?.finalizadoEm ?? null,
  };
}
export type RelatorioInstagram = NonNullable<Awaited<ReturnType<typeof relatorioInstagram>>>;

const SELECAO_MIDIA = {
  id: true,
  tipo: true,
  legenda: true,
  permalink: true,
  miniaturaUrl: true,
  publicadoEm: true,
  alcance: true,
  visualizacoes: true,
  curtidas: true,
  comentarios: true,
  salvamentos: true,
  compartilhamentos: true,
  interacoes: true,
  visitasPerfil: true,
  respostas: true,
  conta: {
    select: {
      usuario: true,
      canal: { select: { id: true, plataforma: true, identificador: true, marca: { select: { nome: true, cor: true } } } },
    },
  },
  publicacao: { select: { id: true, conteudo: { select: { id: true, titulo: true } } } },
} satisfies Prisma.MidiaInstagramSelect;

function midiasDasContas(contaIds: string[], mes: string) {
  return prisma.midiaInstagram.findMany({
    where: { contaId: { in: contaIds }, removidaEm: null, publicadoEm: limitesDoMes(mes) },
    orderBy: { publicadoEm: "desc" },
    select: SELECAO_MIDIA,
  });
}

/** Posts e stories do mês das contas do filtro (sem os removidos), com o conteúdo ligado, se houver. */
export async function listarMidiasDoMes(ator: UsuarioAtual, mes: string, f: FiltroConteudo, ordem: OrdemMidia) {
  exigirUso(ator);
  const contas = await contasDoFiltro(f);
  if (contas.length === 0) return [];
  const midias = await midiasDasContas(
    contas.map((c) => c.id),
    mes,
  );
  return ordenarMidias(midias, ordem);
}
export type LinhaMidia = Awaited<ReturnType<typeof listarMidiasDoMes>>[number];
