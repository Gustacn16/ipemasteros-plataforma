import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { inicioDoDiaSaoPaulo } from "@/modulos/tarefas/regras/relatorio";
import type { FiltroConteudo } from "../esquemas/conteudo";
import { proximoMes } from "../regras/calendario";
import { type NumerosConta, type OrdemMidia, ordenarMidias, totaisDoMes } from "../regras/instagram";

function exigirUso(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "conteudo:usar")) throw new ErroPermissao("conteudo:usar");
}

const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const mesAnterior = (mes: string) => somarDias(`${mes}-01`, -1).slice(0, 7);
/** Instantes de início e fim (exclusivo) do mês "AAAA-MM" em São Paulo. */
const limitesDoMes = (mes: string) => ({ gte: inicioDoDiaSaoPaulo(`${mes}-01`), lt: inicioDoDiaSaoPaulo(`${proximoMes(mes)}-01`) });

/** Contas do Instagram ligadas a um canal que entra no filtro de conta e canal. */
export async function contasDoFiltro(f: FiltroConteudo) {
  const where: Prisma.ContaInstagramWhereInput = {
    ativa: true,
    canal: { ativo: true, excluidoEm: null, ...(f.marca ? { marcaId: f.marca } : {}), ...(f.canal ? { id: f.canal } : {}) },
  };
  return prisma.contaInstagram.findMany({ where, select: { id: true, canalId: true } });
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

/** Último total de seguidores anotado no mês, somado entre as contas. */
async function seguidoresNoMes(contaIds: string[], mes: string): Promise<number | null> {
  let total: number | null = null;
  for (const contaId of contaIds) {
    const linha = await prisma.metricaContaInstagram.findFirst({
      where: {
        contaId,
        periodo: "dia",
        seguidores: { not: null },
        data: { gte: dataDoDia(`${mes}-01`), lt: dataDoDia(`${proximoMes(mes)}-01`) },
      },
      orderBy: { data: "desc" },
      select: { seguidores: true },
    });
    if (linha?.seguidores != null) total = (total ?? 0) + linha.seguidores;
  }
  return total;
}

async function visitasPerfilNoMes(contaIds: string[], mes: string): Promise<number | null> {
  const r = await prisma.midiaInstagram.aggregate({
    where: { contaId: { in: contaIds }, removidaEm: null, publicadoEm: limitesDoMes(mes) },
    _sum: { visitasPerfil: true },
  });
  return r._sum.visitasPerfil;
}

/** Bloco Instagram da visão geral (regras 5.17 e 5.18). `null` quando nenhuma conta do filtro tem Instagram ligado. */
export async function visaoInstagram(ator: UsuarioAtual, f: FiltroConteudo, mes: string) {
  exigirUso(ator);
  const contas = await contasDoFiltro(f);
  if (contas.length === 0) return null;
  const ids = contas.map((c) => c.id);
  const anterior = mesAnterior(mes);

  const linhasMes = (m: string) =>
    prisma.metricaContaInstagram.findMany({ where: { contaId: { in: ids }, periodo: "mes", data: dataDoDia(`${m}-01`) } });
  const [atual, passado, seguidores, seguidoresAnterior, visitas, visitasAnterior, porDia, ultima] = await Promise.all([
    linhasMes(mes),
    linhasMes(anterior),
    seguidoresNoMes(ids, mes),
    seguidoresNoMes(ids, anterior),
    visitasPerfilNoMes(ids, mes),
    visitasPerfilNoMes(ids, anterior),
    prisma.metricaContaInstagram.findMany({
      where: {
        contaId: { in: ids },
        periodo: "dia",
        seguidores: { not: null },
        data: { gte: dataDoDia(`${mes}-01`), lt: dataDoDia(`${proximoMes(mes)}-01`) },
      },
      orderBy: { data: "asc" },
      select: { data: true, seguidores: true },
    }),
    prisma.atualizacaoInstagram.findFirst({
      where: { tipo: "completa", status: "concluida" },
      orderBy: { finalizadoEm: "desc" },
      select: { finalizadoEm: true },
    }),
  ]);

  const seguidoresPorDia = new Map<string, number>();
  for (const l of porDia) {
    const dia = l.data.toISOString().slice(0, 10);
    seguidoresPorDia.set(dia, (seguidoresPorDia.get(dia) ?? 0) + (l.seguidores ?? 0));
  }

  return {
    cartoes: totaisDoMes({
      mes: somar(atual),
      mesAnterior: somar(passado),
      seguidores,
      seguidoresAnterior,
      visitasPerfil: visitas,
      visitasPerfilAnterior: visitasAnterior,
    }),
    seguidoresPorDia: [...seguidoresPorDia].map(([data, total]) => ({ data, seguidores: total })),
    atualizadoEm: ultima?.finalizadoEm ?? null,
  };
}
export type VisaoInstagram = NonNullable<Awaited<ReturnType<typeof visaoInstagram>>>;

/** Posts e stories do mês das contas do filtro (sem os removidos), com o conteúdo ligado, se houver. */
export async function listarMidiasDoMes(ator: UsuarioAtual, mes: string, f: FiltroConteudo, ordem: OrdemMidia) {
  exigirUso(ator);
  const contas = await contasDoFiltro(f);
  if (contas.length === 0) return [];
  const midias = await prisma.midiaInstagram.findMany({
    where: { contaId: { in: contas.map((c) => c.id) }, removidaEm: null, publicadoEm: limitesDoMes(mes) },
    orderBy: { publicadoEm: "desc" },
    select: {
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
    },
  });
  return ordenarMidias(midias, ordem);
}
export type LinhaMidia = Awaited<ReturnType<typeof listarMidiasDoMes>>[number];
