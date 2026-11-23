import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosIndicador, DadosMetasIndicador } from "../esquemas/planejamento";
import { validarParametrosFonte, type ParametrosFonte } from "../regras/fontes";
import { dataDoMes, mesDaData, mesFechado } from "../regras/meses";
import { exigir, garantirPessoa, hojeSp } from "./acesso";

/** Percentual é digitado como "35" e guardado como 0.35. */
export const paraBanco = (unidade: string, v: number) => (unidade === "percentual" ? v / 100 : v);
export const paraTela = (unidade: string, v: number) => (unidade === "percentual" ? v * 100 : v);

export async function listarIndicadoresDoPlano(ator: UsuarioAtual, planoId: string) {
  exigir(ator, "planejamento:ver");
  const lista = await prisma.indicadorPlano.findMany({
    where: { planoId, excluidoEm: null },
    orderBy: [{ frente: "asc" }, { ordem: "asc" }],
    include: { responsavel: { select: { nome: true } }, metas: { select: { mes: true, valor: true } } },
  });
  return lista.map((i) => ({
    id: i.id,
    frente: i.frente,
    grupo: i.grupo,
    nome: i.nome,
    unidade: i.unidade,
    sentido: i.sentido,
    tipo: i.tipo,
    metaCalculada: i.metaCalculada,
    fonte: i.fonte,
    fonteParametros: (i.fonteParametros ?? {}) as ParametrosFonte,
    responsavelId: i.responsavelId,
    responsavel: i.responsavel?.nome ?? null,
    noPainel: i.noPainel,
    metas: Object.fromEntries(i.metas.map((m) => [mesDaData(m.mes), paraTela(i.unidade, m.valor.toNumber())])) as Record<string, number>,
  }));
}
export type IndicadorCadastro = Awaited<ReturnType<typeof listarIndicadoresDoPlano>>[number];

/** Contas do Instagram, canais com formatos e pessoas, para os campos do formulário. */
export async function listarOpcoesDoIndicador() {
  const [contas, canais, pessoas] = await Promise.all([
    prisma.contaInstagram.findMany({ where: { ativa: true }, orderBy: { usuario: "asc" }, select: { id: true, usuario: true } }),
    prisma.canal.findMany({
      where: { ativo: true, excluidoEm: null },
      orderBy: [{ marca: { ordem: "asc" } }, { ordem: "asc" }],
      select: { id: true, plataforma: true, marca: { select: { nome: true } }, formatos: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } } },
    }),
    prisma.usuario.findMany({ where: { ativo: true, papel: { notIn: ["professor", "aluno"] } }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  return {
    contas,
    canais: canais.map((c) => ({ id: c.id, nome: `${c.marca.nome} · ${c.plataforma}`, formatos: c.formatos })),
    pessoas,
  };
}
export type OpcoesIndicador = Awaited<ReturnType<typeof listarOpcoesDoIndicador>>;

function conferirFonte(d: DadosIndicador) {
  const erro = validarParametrosFonte(d.fonte, d.fonteParametros);
  if (erro) throw new ErroNegocio(erro);
}

export async function criarIndicador(ator: UsuarioAtual, planoId: string, d: DadosIndicador) {
  exigir(ator, "planejamento:editar");
  conferirFonte(d);
  await garantirPessoa(d.responsavelId);
  const ultima = await prisma.indicadorPlano.aggregate({ where: { planoId, frente: d.frente, excluidoEm: null }, _max: { ordem: true } });
  return prisma.indicadorPlano.create({
    data: { ...d, fonteParametros: d.fonteParametros as Prisma.InputJsonValue, planoId, ordem: (ultima._max.ordem ?? 0) + 1 },
    select: { id: true },
  });
}

/** Indicador que vem do plano: só nome, responsável e "no Painel" mudam. */
export async function editarIndicador(ator: UsuarioAtual, id: string, d: DadosIndicador) {
  exigir(ator, "planejamento:editar");
  const atual = await prisma.indicadorPlano.findFirst({ where: { id, excluidoEm: null }, select: { metaCalculada: true } });
  if (!atual) throw new ErroNegocio("Indicador não encontrado.");
  await garantirPessoa(d.responsavelId);
  if (atual.metaCalculada) {
    await prisma.indicadorPlano.update({ where: { id }, data: { nome: d.nome, responsavelId: d.responsavelId, noPainel: d.noPainel } });
    return;
  }
  conferirFonte(d);
  await prisma.indicadorPlano.update({ where: { id }, data: { ...d, fonteParametros: d.fonteParametros as Prisma.InputJsonValue } });
}

export async function moverIndicador(ator: UsuarioAtual, id: string, direcao: "subir" | "descer") {
  exigir(ator, "planejamento:editar");
  const atual = await prisma.indicadorPlano.findFirst({ where: { id, excluidoEm: null }, select: { planoId: true, frente: true, ordem: true } });
  if (!atual) throw new ErroNegocio("Indicador não encontrado.");
  const irmaos = await prisma.indicadorPlano.findMany({
    where: { planoId: atual.planoId, frente: atual.frente, excluidoEm: null },
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  const i = irmaos.findIndex((x) => x.id === id);
  const j = direcao === "subir" ? i - 1 : i + 1;
  if (j < 0 || j >= irmaos.length) return;
  [irmaos[i], irmaos[j]] = [irmaos[j], irmaos[i]];
  await prisma.$transaction(irmaos.map((x, ordem) => prisma.indicadorPlano.update({ where: { id: x.id }, data: { ordem: ordem + 1 } })));
}

export async function excluirIndicador(ator: UsuarioAtual, id: string) {
  exigir(ator, "planejamento:editar");
  const ind = await prisma.indicadorPlano.findFirst({ where: { id, excluidoEm: null }, select: { nome: true, metaCalculada: true } });
  if (!ind) throw new ErroNegocio("Indicador não encontrado.");
  if (ind.metaCalculada) throw new ErroNegocio("Este indicador vem do plano; esconda do Painel em vez de excluir.");
  await prisma.$transaction(async (tx) => {
    await tx.indicadorPlano.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria({ usuarioId: ator.id, acao: "planejamento.indicador_excluido", entidade: "IndicadorPlano", entidadeId: id, diff: { nome: ind.nome } }, tx);
  });
}

/** Grava as metas digitadas. Meses fechados não mudam; vazio apaga. */
export async function salvarMetasIndicador(ator: UsuarioAtual, d: DadosMetasIndicador) {
  exigir(ator, "planejamento:editar");
  const ind = await prisma.indicadorPlano.findFirst({
    where: { id: d.indicadorId, excluidoEm: null },
    select: { unidade: true, metaCalculada: true, plano: { select: { ano: true } }, metas: { select: { mes: true, valor: true } } },
  });
  if (!ind) throw new ErroNegocio("Indicador não encontrado.");
  if (ind.metaCalculada) throw new ErroNegocio("A meta deste indicador vem do plano (turmas e funil).");
  const hoje = hojeSp();
  const atuais = Object.fromEntries(ind.metas.map((m) => [mesDaData(m.mes), m.valor.toNumber()]));
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const [mes, valorTela] of Object.entries(d.valores)) {
    if (!mes.startsWith(`${ind.plano.ano}-`)) continue;
    const valor = valorTela === null ? null : paraBanco(ind.unidade, valorTela);
    const antes = atuais[mes] ?? null;
    if (valor === antes || (valor !== null && antes !== null && Math.abs(valor - antes) < 1e-9)) continue;
    if (mesFechado(mes, hoje)) throw new ErroNegocio("A meta de um mês fechado não muda.");
    const chave = { indicadorId_mes: { indicadorId: d.indicadorId, mes: dataDoMes(mes) } };
    ops.push(
      valor === null
        ? prisma.metaMensalIndicador.deleteMany({ where: { indicadorId: d.indicadorId, mes: dataDoMes(mes) } })
        : prisma.metaMensalIndicador.upsert({ where: chave, create: { indicadorId: d.indicadorId, mes: dataDoMes(mes), valor }, update: { valor } }),
    );
  }
  await prisma.$transaction(ops);
}
