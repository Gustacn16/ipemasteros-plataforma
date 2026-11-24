import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { SituacaoAvisoGrupo, SituacaoEnvioAviso, OrigemAvisoGrupo } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { esquemaAviso, horarioSaoPauloParaData } from "../esquemas/aviso";
import { validarJanela } from "../regras/avisos";

const ESCOPO = "whatsapp:avisos";
const MSG_MUDOU = "Este aviso já mudou. Atualize a página.";

export type AvisoNaTela = {
  id: string;
  texto: string;
  agendadoPara: Date;
  situacao: SituacaoAvisoGrupo;
  origem: OrigemAvisoGrupo;
  alerta: string | null;
  textoPorIa: boolean;
  evento: { titulo: string; dataInicio: Date; horaInicio: string | null } | null;
  grupos: { conversaId: string; nome: string; situacao: SituacaoEnvioAviso; erro: string | null }[];
};

function exigir(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, ESCOPO)) throw new ErroPermissao(ESCOPO);
}

export async function listarAvisos(ator: UsuarioAtual, de: Date, ate: Date): Promise<AvisoNaTela[]> {
  exigir(ator);
  const avisos = await prisma.avisoGrupo.findMany({
    where: { agendadoPara: { gte: de, lte: ate } },
    include: {
      evento: { select: { titulo: true, dataInicio: true, horaInicio: true } },
      envios: { include: { conversa: { select: { nome: true } } }, orderBy: { id: "asc" } },
    },
    orderBy: { agendadoPara: "asc" },
  });
  const lista: AvisoNaTela[] = avisos.map((a) => ({
    id: a.id,
    texto: a.texto,
    agendadoPara: a.agendadoPara,
    situacao: a.situacao,
    origem: a.origem,
    alerta: a.alerta,
    textoPorIa: a.textoPorIa,
    evento: a.evento,
    grupos: a.envios
      .map((e) => ({ conversaId: e.conversaId, nome: e.conversa?.nome ?? "Grupo sem nome", situacao: e.situacao, erro: e.erro }))
      .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")),
  }));
  // Rascunhos primeiro; a ordenação é estável, então cada bloco segue por horário.
  return [...lista.filter((a) => a.situacao === "rascunho"), ...lista.filter((a) => a.situacao !== "rascunho")];
}

export async function listarGruposParaAviso(ator: UsuarioAtual): Promise<{ id: string; nome: string }[]> {
  exigir(ator);
  const grupos = await prisma.conversaWhatsapp.findMany({
    where: { tipo: "grupo", monitorada: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return grupos.map((g) => ({ id: g.id, nome: g.nome ?? "Grupo sem nome" }));
}

export async function salvarAviso(ator: UsuarioAtual, dados: unknown): Promise<{ id: string }> {
  exigir(ator);
  const v = esquemaAviso.parse(dados);
  const agendadoPara = horarioSaoPauloParaData(v.agendadoPara);
  const validos = await prisma.conversaWhatsapp.findMany({
    where: { id: { in: v.grupos }, tipo: "grupo", monitorada: true },
    select: { id: true },
  });
  if (validos.length !== v.grupos.length) throw new ErroNegocio("Algum grupo escolhido não está mais disponível.");

  return prisma.$transaction(async (tx) => {
    let id: string;
    if (v.id) {
      const atual = await tx.avisoGrupo.findUnique({ where: { id: v.id }, select: { id: true, situacao: true } });
      if (!atual) throw new ErroNegocio("Aviso não encontrado.");
      if (atual.situacao !== "rascunho" && atual.situacao !== "aprovado") {
        throw new ErroNegocio("Só é possível editar um aviso em rascunho ou aprovado.");
      }
      const r = await tx.avisoGrupo.updateMany({
        where: { id: v.id, situacao: { in: ["rascunho", "aprovado"] } },
        data: {
          texto: v.texto,
          agendadoPara,
          situacao: "rascunho",
          aprovadoPorId: null,
          aprovadoEm: null,
          retratoEvento: Prisma.DbNull,
        },
      });
      if (r.count === 0) throw new ErroNegocio(MSG_MUDOU);
      await tx.envioAvisoGrupo.deleteMany({ where: { avisoId: v.id } });
      id = v.id;
    } else {
      const criado = await tx.avisoGrupo.create({
        data: { texto: v.texto, agendadoPara, origem: "avulso", criadoPorId: ator.id },
        select: { id: true },
      });
      id = criado.id;
    }
    await tx.envioAvisoGrupo.createMany({ data: v.grupos.map((conversaId) => ({ avisoId: id, conversaId })) });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: v.id ? "whatsapp.aviso.editar" : "whatsapp.aviso.criar",
        entidade: "AvisoGrupo",
        entidadeId: id,
        diff: { grupos: v.grupos.length },
      },
      tx,
    );
    return { id };
  });
}

export async function aprovarAviso(ator: UsuarioAtual, id: string): Promise<void> {
  exigir(ator);
  await prisma.$transaction(async (tx) => {
    const aviso = await tx.avisoGrupo.findUnique({
      where: { id },
      include: {
        envios: { select: { id: true } },
        evento: { select: { titulo: true, dataInicio: true, horaInicio: true, local: true } },
      },
    });
    if (!aviso) throw new ErroNegocio("Aviso não encontrado.");
    if (aviso.situacao !== "rascunho") throw new ErroNegocio("Só é possível aprovar um aviso em rascunho.");
    const erroJanela = validarJanela(aviso.agendadoPara, aviso.envios.length);
    if (erroJanela) throw new ErroNegocio(erroJanela);
    const retratoEvento = aviso.evento
      ? {
          titulo: aviso.evento.titulo,
          dataInicio: aviso.evento.dataInicio.toISOString(),
          horaInicio: aviso.evento.horaInicio,
          local: aviso.evento.local,
        }
      : undefined;
    const r = await tx.avisoGrupo.updateMany({
      where: { id, situacao: "rascunho" },
      data: { situacao: "aprovado", aprovadoPorId: ator.id, aprovadoEm: new Date(), ...(retratoEvento ? { retratoEvento } : {}) },
    });
    if (r.count === 0) throw new ErroNegocio(MSG_MUDOU);
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.aviso.aprovar",
        entidade: "AvisoGrupo",
        entidadeId: id,
        diff: { grupos: aviso.envios.length },
      },
      tx,
    );
  });
}

export async function aprovarTodos(
  ator: UsuarioAtual,
  de: Date,
  ate: Date,
): Promise<{ aprovados: number; recusados: { id: string; motivo: string }[] }> {
  exigir(ator);
  const rascunhos = await prisma.avisoGrupo.findMany({
    where: { situacao: "rascunho", agendadoPara: { gte: de, lte: ate } },
    select: { id: true },
    orderBy: { agendadoPara: "asc" },
  });
  let aprovados = 0;
  const recusados: { id: string; motivo: string }[] = [];
  for (const { id } of rascunhos) {
    try {
      await aprovarAviso(ator, id);
      aprovados++;
    } catch (erro) {
      if (!(erro instanceof ErroNegocio)) throw erro;
      recusados.push({ id, motivo: erro.message });
    }
  }
  return { aprovados, recusados };
}

export async function cancelarAviso(ator: UsuarioAtual, id: string): Promise<void> {
  exigir(ator);
  await prisma.$transaction(async (tx) => {
    const aviso = await tx.avisoGrupo.findUnique({
      where: { id },
      select: { id: true, situacao: true, _count: { select: { envios: true } } },
    });
    if (!aviso) throw new ErroNegocio("Aviso não encontrado.");
    if (aviso.situacao !== "rascunho" && aviso.situacao !== "aprovado") {
      throw new ErroNegocio("Só é possível cancelar um aviso em rascunho ou aprovado.");
    }
    const r = await tx.avisoGrupo.updateMany({
      where: { id, situacao: { in: ["rascunho", "aprovado"] } },
      data: { situacao: "cancelado", canceladoEm: new Date() },
    });
    if (r.count === 0) throw new ErroNegocio(MSG_MUDOU);
    await tx.envioAvisoGrupo.updateMany({ where: { avisoId: id }, data: { situacao: "cancelado" } });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.aviso.cancelar",
        entidade: "AvisoGrupo",
        entidadeId: id,
        diff: { grupos: aviso._count.envios },
      },
      tx,
    );
  });
}
