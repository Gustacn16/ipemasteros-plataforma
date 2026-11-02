import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { MENSAGEM_NAO_ENCONTRADO, exigirEspaco, exigirPermissaoTarefas, exigirTarefa, podeEditarTarefa } from "./acesso";
import { proximaOrdem } from "./ordem";

// Checklist e etiquetas da tarefa. Quem vê a tarefa pode usar o checklist
// (inclusive o professor, nas tarefas em que é responsável); etiquetas são do espaço.

const LIMITE_ITENS = 100;

async function exigirItem(ator: UsuarioAtual, itemId: string) {
  const item = await prisma.itemChecklist.findUnique({ where: { id: itemId } });
  if (!item) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  await exigirTarefa(ator, item.tarefaId);
  return item;
}

export async function adicionarItemChecklist(ator: UsuarioAtual, tarefaId: string, texto: string) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  await exigirTarefa(ator, tarefaId);
  const [total, maior] = await Promise.all([
    prisma.itemChecklist.count({ where: { tarefaId } }),
    prisma.itemChecklist.aggregate({ _max: { ordem: true }, where: { tarefaId } }),
  ]);
  if (total >= LIMITE_ITENS) throw new ErroNegocio(`O checklist aceita até ${LIMITE_ITENS} itens.`);
  await prisma.itemChecklist.create({ data: { tarefaId, texto, ordem: proximaOrdem(maior._max.ordem) } });
}

export async function atualizarItemChecklist(ator: UsuarioAtual, itemId: string, campos: { texto?: string; concluido?: boolean }) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  await exigirItem(ator, itemId);
  await prisma.itemChecklist.update({ where: { id: itemId }, data: campos });
}

export async function removerItemChecklist(ator: UsuarioAtual, itemId: string) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  await exigirItem(ator, itemId);
  await prisma.itemChecklist.delete({ where: { id: itemId } });
}

/** Troca o item de lugar com o vizinho de cima ou de baixo. */
export async function moverItemChecklist(ator: UsuarioAtual, itemId: string, direcao: "cima" | "baixo") {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  const item = await exigirItem(ator, itemId);
  const vizinho = await prisma.itemChecklist.findFirst({
    where: { tarefaId: item.tarefaId, ordem: direcao === "cima" ? { lt: item.ordem } : { gt: item.ordem } },
    orderBy: { ordem: direcao === "cima" ? "desc" : "asc" },
  });
  if (!vizinho) return;
  await prisma.$transaction([
    prisma.itemChecklist.update({ where: { id: item.id }, data: { ordem: vizinho.ordem } }),
    prisma.itemChecklist.update({ where: { id: vizinho.id }, data: { ordem: item.ordem } }),
  ]);
}

// ── Etiquetas ─────────────────────────────────────────────────────────────

export function listarEtiquetas(espacoId: string) {
  return prisma.etiqueta.findMany({ where: { espacoId }, orderBy: { nome: "asc" }, select: { id: true, nome: true, cor: true } });
}

async function exigirNomeLivre(espacoId: string, nome: string, ignorarId?: string) {
  const repetida = await prisma.etiqueta.findFirst({ where: { espacoId, nome, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (repetida) throw new ErroNegocio("Já existe uma etiqueta com esse nome neste espaço.");
}

export async function criarEtiqueta(ator: UsuarioAtual, dados: { espacoId: string; nome: string; cor: string }) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  await exigirEspaco(ator, dados.espacoId);
  await exigirNomeLivre(dados.espacoId, dados.nome);
  return prisma.etiqueta.create({ data: dados, select: { id: true, nome: true, cor: true } });
}

async function exigirEtiqueta(ator: UsuarioAtual, etiquetaId: string) {
  const etiqueta = await prisma.etiqueta.findUnique({ where: { id: etiquetaId } });
  if (!etiqueta) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  await exigirEspaco(ator, etiqueta.espacoId);
  return etiqueta;
}

export async function editarEtiqueta(ator: UsuarioAtual, dados: { etiquetaId: string; nome: string; cor: string }) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  const etiqueta = await exigirEtiqueta(ator, dados.etiquetaId);
  await exigirNomeLivre(etiqueta.espacoId, dados.nome, etiqueta.id);
  await prisma.etiqueta.update({ where: { id: etiqueta.id }, data: { nome: dados.nome, cor: dados.cor } });
}

/** Etiqueta não é dado de negócio: some de todas as tarefas do espaço. */
export async function excluirEtiqueta(ator: UsuarioAtual, etiquetaId: string) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  await exigirEtiqueta(ator, etiquetaId);
  await prisma.etiqueta.delete({ where: { id: etiquetaId } });
}

export async function definirEtiquetasTarefa(ator: UsuarioAtual, tarefaId: string, etiquetaIds: string[]) {
  exigirPermissaoTarefas(ator, "tarefas:usar");
  if (!podeEditarTarefa(ator)) throw new ErroPermissao("tarefas:editar");
  const tarefa = await exigirTarefa(ator, tarefaId);
  const ids = [...new Set(etiquetaIds)];
  const validas = await prisma.etiqueta.count({ where: { id: { in: ids }, espacoId: tarefa.lista.espacoId } });
  if (validas !== ids.length) throw new ErroNegocio("Etiqueta de outro espaço.");
  await prisma.$transaction([
    prisma.tarefaEtiqueta.deleteMany({ where: { tarefaId, etiquetaId: { notIn: ids } } }),
    prisma.tarefaEtiqueta.createMany({ data: ids.map((etiquetaId) => ({ tarefaId, etiquetaId })), skipDuplicates: true }),
  ]);
}
