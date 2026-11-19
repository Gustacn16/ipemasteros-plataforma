import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import type { DadosIndicador, DadosMedicao } from "../esquemas/processos";
import { inicioDoPeriodo, situacaoIndicador, type Frequencia, type Sentido } from "../regras/indicadores";
import { deDia, exigir, numeroOuNulo, paraDia, podeEditar, podeLancarMedicao } from "./acesso";
import { garantirPessoa } from "./documentos";

const MEDICOES_NO_GRAFICO = 12;

const selecaoIndicador = {
  id: true,
  documentoId: true,
  nome: true,
  descricao: true,
  unidade: true,
  sentido: true,
  meta: true,
  frequencia: true,
  responsavelId: true,
  responsavel: { select: { nome: true } },
  medicoes: {
    orderBy: { periodo: "desc" },
    take: MEDICOES_NO_GRAFICO,
    select: { id: true, periodo: true, valor: true, meta: true, analise: true, registradoPor: { select: { nome: true } }, atualizadoEm: true },
  },
} as const;

type IndicadorBanco = Awaited<ReturnType<typeof buscarIndicadores>>[number];
const buscarIndicadores = (where: object) =>
  prisma.indicadorProcesso.findMany({ where: { excluidoEm: null, ...where }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: selecaoIndicador });

function montar(ator: UsuarioAtual, i: IndicadorBanco, hoje: string) {
  const medicoes = i.medicoes
    .map((m) => ({
      id: m.id,
      periodo: deDia(m.periodo),
      valor: m.valor.toNumber(),
      meta: numeroOuNulo(m.meta),
      analise: m.analise,
      registradoPor: m.registradoPor.nome,
      atualizadoEm: m.atualizadoEm,
    }))
    .reverse(); // mais antiga → mais recente
  const indicador = { frequencia: i.frequencia as Frequencia, sentido: i.sentido as Sentido };
  return {
    id: i.id,
    documentoId: i.documentoId,
    nome: i.nome,
    descricao: i.descricao,
    unidade: i.unidade,
    sentido: indicador.sentido,
    frequencia: indicador.frequencia,
    meta: numeroOuNulo(i.meta),
    responsavelId: i.responsavelId,
    responsavel: i.responsavel?.nome ?? null,
    medicoes,
    situacao: situacaoIndicador(medicoes.at(-1) ?? null, indicador, hoje),
    periodoAtual: inicioDoPeriodo(hoje, indicador.frequencia),
    podeLancar: podeLancarMedicao(ator, i.responsavelId),
  };
}
export type IndicadorTela = ReturnType<typeof montar>;

export async function listarIndicadoresDoDocumento(ator: UsuarioAtual, documentoId: string) {
  exigir(ator, "processos:ver");
  const hoje = diaEmSaoPaulo(new Date());
  return (await buscarIndicadores({ documentoId })).map((i) => montar(ator, i, hoje));
}

/** Todos os indicadores dos documentos que o ator vê, com caminho para o painel. */
export async function obterPainel(ator: UsuarioAtual) {
  exigir(ator, "processos:ver");
  const editor = podeEditar(ator);
  const hoje = diaEmSaoPaulo(new Date());
  const lista = await prisma.indicadorProcesso.findMany({
    where: { excluidoEm: null, documento: { excluidoEm: null, ...(editor ? {} : { versaoPublicada: { gt: 0 } }) } },
    orderBy: [{ documento: { titulo: "asc" } }, { ordem: "asc" }, { nome: "asc" }],
    select: {
      ...selecaoIndicador,
      documento: {
        select: { id: true, titulo: true, tituloPublicado: true, area: { select: { nome: true, categoria: { select: { nome: true, ordem: true } } } } },
      },
    },
  });
  return lista.map((i) => ({
    ...montar(ator, i, hoje),
    documento: {
      id: i.documento.id,
      titulo: editor ? i.documento.titulo : (i.documento.tituloPublicado ?? i.documento.titulo),
      caminho: `${i.documento.area.categoria.nome} · ${i.documento.area.nome}`,
    },
  }));
}
export type IndicadorPainel = Awaited<ReturnType<typeof obterPainel>>[number];

async function garantirDocumento(documentoId: string) {
  const d = await prisma.documentoProcesso.findFirst({ where: { id: documentoId, excluidoEm: null }, select: { id: true } });
  if (!d) throw new ErroNegocio("Documento não encontrado.");
}

export async function criarIndicador(ator: UsuarioAtual, documentoId: string, dados: DadosIndicador) {
  exigir(ator, "processos:editar");
  await garantirDocumento(documentoId);
  await garantirPessoa(dados.responsavelId);
  const ultima = await prisma.indicadorProcesso.aggregate({ where: { documentoId, excluidoEm: null }, _max: { ordem: true } });
  return prisma.indicadorProcesso.create({ data: { ...dados, documentoId, ordem: (ultima._max.ordem ?? 0) + 1 }, select: { id: true } });
}

export async function editarIndicador(ator: UsuarioAtual, id: string, dados: DadosIndicador) {
  exigir(ator, "processos:editar");
  await garantirPessoa(dados.responsavelId);
  const r = await prisma.indicadorProcesso.updateMany({ where: { id, excluidoEm: null }, data: dados });
  if (r.count === 0) throw new ErroNegocio("Indicador não encontrado.");
}

export async function excluirIndicador(ator: UsuarioAtual, id: string) {
  exigir(ator, "processos:editar");
  await prisma.$transaction(async (tx) => {
    const ind = await tx.indicadorProcesso.findFirst({ where: { id, excluidoEm: null }, select: { nome: true, documentoId: true } });
    if (!ind) throw new ErroNegocio("Indicador não encontrado.");
    await tx.indicadorProcesso.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.indicador_excluido", entidade: "IndicadorProcesso", entidadeId: id, diff: { nome: ind.nome, documentoId: ind.documentoId } },
      tx,
    );
  });
}

async function indicadorParaLancar(ator: UsuarioAtual, indicadorId: string) {
  exigir(ator, "processos:ver");
  const ind = await prisma.indicadorProcesso.findFirst({
    where: { id: indicadorId, excluidoEm: null, documento: { excluidoEm: null } },
    select: { id: true, meta: true, frequencia: true, responsavelId: true, documento: { select: { versaoPublicada: true } } },
  });
  if (!ind || (!podeEditar(ator) && ind.documento.versaoPublicada === 0)) throw new ErroNegocio("Indicador não encontrado.");
  if (!podeLancarMedicao(ator, ind.responsavelId)) throw new ErroPermissao("processos:registrar_medicao");
  return ind;
}

/** Lança (ou corrige) o resultado do período. A meta vigente fica gravada junto. */
export async function registrarMedicao(ator: UsuarioAtual, indicadorId: string, dados: DadosMedicao) {
  const ind = await indicadorParaLancar(ator, indicadorId);
  const periodo = inicioDoPeriodo(dados.periodo, ind.frequencia as Frequencia);
  if (periodo > diaEmSaoPaulo(new Date())) throw new ErroNegocio("Esse período ainda não começou.");
  const valores = { valor: dados.valor, analise: dados.analise, meta: ind.meta, registradoPorId: ator.id };
  await prisma.medicaoIndicador.upsert({
    where: { indicadorId_periodo: { indicadorId, periodo: paraDia(periodo) } },
    create: { indicadorId, periodo: paraDia(periodo), ...valores },
    update: valores,
  });
}

export async function excluirMedicao(ator: UsuarioAtual, medicaoId: string) {
  const medicao = await prisma.medicaoIndicador.findUnique({ where: { id: medicaoId }, select: { indicadorId: true, periodo: true } });
  if (!medicao) throw new ErroNegocio("Resultado não encontrado.");
  await indicadorParaLancar(ator, medicao.indicadorId);
  await prisma.$transaction(async (tx) => {
    await tx.medicaoIndicador.delete({ where: { id: medicaoId } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "processos.medicao_excluida", entidade: "MedicaoIndicador", entidadeId: medicaoId, diff: { indicadorId: medicao.indicadorId, periodo: deDia(medicao.periodo) } },
      tx,
    );
  });
}
