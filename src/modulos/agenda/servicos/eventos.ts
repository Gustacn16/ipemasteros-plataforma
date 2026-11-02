import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaDaDataEntrega } from "@/modulos/tarefas/regras/prazo";
import type { DadosEvento, DadosLote } from "../esquemas/agenda";
import { ordenarLote, titulosDoLote } from "../regras/periodo";
import { filtroEventosVisiveis } from "../regras/visibilidade";
import { exigir } from "./acesso";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const NAO_ENCONTRADO = "Não encontrado.";

const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);
const vazioParaNulo = (v: string | undefined) => (v === undefined || v === "" ? null : v);

const selecaoEvento = {
  id: true,
  tipoId: true,
  titulo: true,
  turma: true,
  local: true,
  descricao: true,
  dataInicio: true,
  dataFim: true,
  horaInicio: true,
  horaFim: true,
  visivelProfessores: true,
  loteId: true,
  tipo: { select: { nome: true, cor: true } },
} satisfies Prisma.EventoInstitucionalSelect;

type LinhaEvento = Prisma.EventoInstitucionalGetPayload<{ select: typeof selecaoEvento }>;

function paraEvento(e: LinhaEvento) {
  return { ...e, dataInicio: diaDaDataEntrega(e.dataInicio), dataFim: diaDaDataEntrega(e.dataFim) };
}
export type EventoAgenda = ReturnType<typeof paraEvento>;

export async function listarEventos(
  ator: UsuarioAtual,
  filtro: { de: string; ate: string; tipos?: string[]; turma?: string },
): Promise<EventoAgenda[]> {
  const where: Prisma.EventoInstitucionalWhereInput = {
    AND: [filtroEventosVisiveis(ator.papel)],
    dataInicio: { lte: dia(filtro.ate) },
    dataFim: { gte: dia(filtro.de) },
    ...(filtro.tipos?.length ? { tipoId: { in: filtro.tipos } } : {}),
    ...(filtro.turma ? { turma: filtro.turma } : {}),
  };
  const linhas = await prisma.eventoInstitucional.findMany({
    where,
    select: selecaoEvento,
    orderBy: [{ dataInicio: "asc" }, { horaInicio: "asc" }],
  });
  return linhas.map(paraEvento);
}

export async function listarTurmas(ator: UsuarioAtual): Promise<string[]> {
  const linhas = await prisma.eventoInstitucional.findMany({
    where: { AND: [filtroEventosVisiveis(ator.papel)], turma: { not: null } },
    select: { turma: true },
    distinct: ["turma"],
    orderBy: { turma: "asc" },
  });
  return linhas.flatMap((l) => (l.turma ? [l.turma] : []));
}

export async function obterEvento(ator: UsuarioAtual, id: string) {
  const evento = await prisma.eventoInstitucional.findFirst({
    where: { AND: [{ id }, filtroEventosVisiveis(ator.papel)] },
    select: selecaoEvento,
  });
  if (!evento) throw new ErroNegocio(NAO_ENCONTRADO);
  const doLote = evento.loteId
    ? (
        await prisma.eventoInstitucional.findMany({
          where: { AND: [{ loteId: evento.loteId, id: { not: id } }, filtroEventosVisiveis(ator.papel)] },
          select: selecaoEvento,
          orderBy: [{ dataInicio: "asc" }, { horaInicio: "asc" }],
        })
      ).map(paraEvento)
    : [];
  return {
    ...paraEvento(evento),
    doLote,
    podeEditar: temPermissao(ator.papel, "agenda:editar_institucional"),
  };
}

async function validarTipo(tx: Tx, tipoId: string, tipoAtualId?: string) {
  const tipo = await tx.tipoEvento.findUnique({ where: { id: tipoId } });
  if (!tipo) throw new ErroNegocio("Escolha um tipo ativo.");
  if (!tipo.ativo && tipo.id !== tipoAtualId) throw new ErroNegocio("Escolha um tipo ativo.");
}

function camposComuns(d: Pick<DadosEvento, "tipoId" | "turma" | "local" | "descricao" | "visivelProfessores">) {
  return {
    tipoId: d.tipoId,
    turma: vazioParaNulo(d.turma),
    local: vazioParaNulo(d.local),
    descricao: vazioParaNulo(d.descricao),
    visivelProfessores: d.visivelProfessores,
  };
}

export async function criarEvento(ator: UsuarioAtual, dados: DadosEvento) {
  exigir(ator, "agenda:editar_institucional");
  return prisma.$transaction(async (tx) => {
    await validarTipo(tx, dados.tipoId);
    const evento = await tx.eventoInstitucional.create({
      data: {
        ...camposComuns(dados),
        titulo: dados.titulo,
        dataInicio: dia(dados.dataInicio),
        dataFim: dia(dados.dataFim),
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        criadoPorId: ator.id,
      },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "agenda.evento_criado",
        entidade: "EventoInstitucional",
        entidadeId: evento.id,
        diff: { titulo: dados.titulo, dataInicio: dados.dataInicio, dataFim: dados.dataFim },
      },
      tx,
    );
    return { id: evento.id };
  });
}

export async function criarLote(ator: UsuarioAtual, dados: DadosLote): Promise<{ quantidade: number }> {
  exigir(ator, "agenda:editar_institucional");
  const periodos = ordenarLote(
    dados.periodos.map((p) => ({ ...p, horaInicio: dados.horaInicio, horaFim: dados.horaFim })),
  );
  const titulos = titulosDoLote(dados.titulo, periodos.length, dados.numerar);
  const loteId = crypto.randomUUID();
  return prisma.$transaction(async (tx) => {
    await validarTipo(tx, dados.tipoId);
    await tx.eventoInstitucional.createMany({
      data: periodos.map((p, i) => ({
        ...camposComuns(dados),
        titulo: titulos[i],
        dataInicio: dia(p.dataInicio),
        dataFim: dia(p.dataFim),
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
        loteId,
        criadoPorId: ator.id,
      })),
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "agenda.evento_criado",
        entidade: "EventoInstitucional",
        entidadeId: loteId,
        diff: { quantidade: periodos.length, loteId },
      },
      tx,
    );
    return { quantidade: periodos.length };
  });
}

async function exigirEventoEditavel(tx: Tx, ator: UsuarioAtual, id: string) {
  const evento = await tx.eventoInstitucional.findFirst({
    where: { AND: [{ id }, filtroEventosVisiveis(ator.papel)] },
  });
  if (!evento) throw new ErroNegocio(NAO_ENCONTRADO);
  return evento;
}

export async function editarEvento(ator: UsuarioAtual, id: string, dados: DadosEvento) {
  exigir(ator, "agenda:editar_institucional");
  await prisma.$transaction(async (tx) => {
    const antes = await exigirEventoEditavel(tx, ator, id);
    await validarTipo(tx, dados.tipoId, antes.tipoId);
    await tx.eventoInstitucional.update({
      where: { id },
      data: {
        ...camposComuns(dados),
        titulo: dados.titulo,
        dataInicio: dia(dados.dataInicio),
        dataFim: dia(dados.dataFim),
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
      },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "agenda.evento_editado",
        entidade: "EventoInstitucional",
        entidadeId: id,
        diff: {
          antes: { titulo: antes.titulo, dataInicio: diaDaDataEntrega(antes.dataInicio), dataFim: diaDaDataEntrega(antes.dataFim) },
          depois: { titulo: dados.titulo, dataInicio: dados.dataInicio, dataFim: dados.dataFim },
        },
      },
      tx,
    );
  });
}

export async function excluirEvento(ator: UsuarioAtual, id: string) {
  exigir(ator, "agenda:editar_institucional");
  await prisma.$transaction(async (tx) => {
    const evento = await exigirEventoEditavel(tx, ator, id);
    await tx.eventoInstitucional.update({ where: { id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "agenda.evento_excluido", entidade: "EventoInstitucional", entidadeId: id, diff: { titulo: evento.titulo } },
      tx,
    );
  });
}
