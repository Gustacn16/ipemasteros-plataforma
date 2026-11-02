import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { exigirEspaco, exigirPermissaoTarefas, filtroEspacosVisiveis } from "./acesso";
import { proximaOrdem } from "./ordem";
import { listarEtiquetas } from "./detalhes";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Espaços visíveis com suas listas, para a barra lateral. */
export async function listarArvore(ator: UsuarioAtual) {
  return prisma.espaco.findMany({
    where: filtroEspacosVisiveis(ator),
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      cor: true,
      listas: {
        where: { excluidoEm: null },
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
        select: { id: true, nome: true },
      },
    },
  });
}

async function garantirNomeLivre(tx: Tx, nome: string, ignorarId?: string) {
  const existente = await tx.espaco.findFirst({
    where: { nome, excluidoEm: null, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true },
  });
  if (existente) throw new ErroNegocio("Já existe um espaço com este nome.");
}

export async function criarEspaco(ator: UsuarioAtual, dados: { nome: string; cor: string }) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_espacos");
  return prisma.$transaction(async (tx) => {
    await garantirNomeLivre(tx, dados.nome);
    const maior = await tx.espaco.aggregate({ _max: { ordem: true }, where: { excluidoEm: null } });
    const espaco = await tx.espaco.create({
      data: {
        nome: dados.nome,
        cor: dados.cor,
        ordem: proximaOrdem(maior._max.ordem),
        // Quem cria entra como membro, para o espaço aparecer também para ele.
        membros: { create: { usuarioId: ator.id } },
      },
    });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "espaco.criado", entidade: "Espaco", entidadeId: espaco.id, diff: { nome: dados.nome } },
      tx,
    );
    return espaco;
  });
}

export async function editarEspaco(ator: UsuarioAtual, espacoId: string, dados: { nome: string; cor: string }) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_espacos");
  await exigirEspaco(ator, espacoId);
  await prisma.$transaction(async (tx) => {
    await garantirNomeLivre(tx, dados.nome, espacoId);
    await tx.espaco.update({ where: { id: espacoId }, data: dados });
  });
}

export async function excluirEspaco(ator: UsuarioAtual, espacoId: string) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_espacos");
  const espaco = await exigirEspaco(ator, espacoId);
  await prisma.$transaction(async (tx) => {
    await tx.espaco.update({ where: { id: espacoId }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "espaco.excluido", entidade: "Espaco", entidadeId: espacoId, diff: { nome: espaco.nome } },
      tx,
    );
  });
}

export async function obterConfiguracaoEspaco(ator: UsuarioAtual, espacoId: string) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_espacos");
  const espaco = await exigirEspaco(ator, espacoId);
  const [membros, usuarios, etiquetas] = await Promise.all([
    prisma.membroEspaco.findMany({ where: { espacoId }, select: { usuarioId: true } }),
    prisma.usuario.findMany({
      where: { ativo: true, papel: { in: ["admin", "gestor", "colaborador"] } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true, papel: true },
    }),
    listarEtiquetas(espacoId),
  ]);
  return { espaco, membroIds: membros.map((m) => m.usuarioId), usuarios, etiquetas };
}

export async function definirMembros(ator: UsuarioAtual, espacoId: string, usuarioIds: string[]) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_espacos");
  await exigirEspaco(ator, espacoId);
  const ids = [...new Set(usuarioIds)];
  const validos = await prisma.usuario.count({ where: { id: { in: ids }, ativo: true } });
  if (validos !== ids.length) throw new ErroNegocio("Há usuários inválidos na seleção.");

  await prisma.$transaction(async (tx) => {
    const antes = (await tx.membroEspaco.findMany({ where: { espacoId }, select: { usuarioId: true } })).map(
      (m) => m.usuarioId,
    );
    await tx.membroEspaco.deleteMany({ where: { espacoId, usuarioId: { notIn: ids } } });
    await tx.membroEspaco.createMany({
      data: ids.filter((id) => !antes.includes(id)).map((usuarioId) => ({ espacoId, usuarioId })),
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "espaco.membros_alterados",
        entidade: "Espaco",
        entidadeId: espacoId,
        diff: { antes, depois: ids },
      },
      tx,
    );
  });
}
