import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { exigir } from "./acesso";

const MENSAGEM_NOME_REPETIDO = "Já existe um tipo com esse nome.";

function traduzirErro(erro: unknown): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    throw new ErroNegocio(MENSAGEM_NOME_REPETIDO);
  }
  throw erro;
}

export async function listarTipos(ator: UsuarioAtual, { incluirInativos }: { incluirInativos: boolean }) {
  exigir(ator, "agenda:usar");
  return prisma.tipoEvento.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, cor: true, ordem: true, ativo: true },
  });
}

export async function criarTipo(ator: UsuarioAtual, dados: { nome: string; cor: string }) {
  exigir(ator, "agenda:gerenciar_tipos");
  try {
    return await prisma.$transaction(async (tx) => {
      const maior = await tx.tipoEvento.aggregate({ _max: { ordem: true } });
      const tipo = await tx.tipoEvento.create({
        data: { nome: dados.nome, cor: dados.cor, ordem: (maior._max.ordem ?? 0) + 1 },
      });
      await registrarAuditoria(
        { usuarioId: ator.id, acao: "agenda.tipo_alterado", entidade: "TipoEvento", entidadeId: tipo.id, diff: { criado: dados } },
        tx,
      );
      return tipo;
    });
  } catch (erro) {
    return traduzirErro(erro);
  }
}

async function exigirTipo(tx: Pick<typeof prisma, "tipoEvento">, id: string) {
  const tipo = await tx.tipoEvento.findUnique({ where: { id } });
  if (!tipo) throw new ErroNegocio("Não encontrado.");
  return tipo;
}

export async function editarTipo(ator: UsuarioAtual, id: string, dados: { nome: string; cor: string }) {
  exigir(ator, "agenda:gerenciar_tipos");
  try {
    await prisma.$transaction(async (tx) => {
      const antes = await exigirTipo(tx, id);
      await tx.tipoEvento.update({ where: { id }, data: { nome: dados.nome, cor: dados.cor } });
      await registrarAuditoria(
        {
          usuarioId: ator.id,
          acao: "agenda.tipo_alterado",
          entidade: "TipoEvento",
          entidadeId: id,
          diff: { antes: { nome: antes.nome, cor: antes.cor }, depois: dados },
        },
        tx,
      );
    });
  } catch (erro) {
    traduzirErro(erro);
  }
}

export async function moverTipo(ator: UsuarioAtual, id: string, direcao: "cima" | "baixo") {
  exigir(ator, "agenda:gerenciar_tipos");
  await prisma.$transaction(async (tx) => {
    const tipo = await exigirTipo(tx, id);
    const vizinho = await tx.tipoEvento.findFirst({
      where: direcao === "cima" ? { ordem: { lt: tipo.ordem } } : { ordem: { gt: tipo.ordem } },
      orderBy: { ordem: direcao === "cima" ? "desc" : "asc" },
    });
    if (!vizinho) return; // já está na ponta
    await tx.tipoEvento.update({ where: { id: tipo.id }, data: { ordem: vizinho.ordem } });
    await tx.tipoEvento.update({ where: { id: vizinho.id }, data: { ordem: tipo.ordem } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "agenda.tipo_alterado", entidade: "TipoEvento", entidadeId: id, diff: { moveu: direcao } },
      tx,
    );
  });
}

export async function definirAtivo(ator: UsuarioAtual, id: string, ativo: boolean) {
  exigir(ator, "agenda:gerenciar_tipos");
  await prisma.$transaction(async (tx) => {
    await exigirTipo(tx, id);
    await tx.tipoEvento.update({ where: { id }, data: { ativo } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "agenda.tipo_alterado", entidade: "TipoEvento", entidadeId: id, diff: { ativo } },
      tx,
    );
  });
}
