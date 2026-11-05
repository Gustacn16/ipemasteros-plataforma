import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { STATUS_PADRAO, validarConjuntoStatus, type TipoStatus } from "../regras/status";
import { MENSAGEM_NAO_ENCONTRADO, exigirEspaco, exigirLista, exigirPermissaoTarefas } from "./acesso";
import { proximaOrdem } from "./ordem";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function criarLista(ator: UsuarioAtual, dados: { espacoId: string; nome: string }) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  await exigirEspaco(ator, dados.espacoId);
  return prisma.$transaction(async (tx) => {
    const maior = await tx.lista.aggregate({
      _max: { ordem: true },
      where: { espacoId: dados.espacoId, excluidoEm: null },
    });
    return tx.lista.create({
      data: {
        espacoId: dados.espacoId,
        nome: dados.nome,
        ordem: proximaOrdem(maior._max.ordem),
        status: { create: STATUS_PADRAO.map((s, i) => ({ ...s, ordem: i + 1 })) },
      },
    });
  });
}

export async function renomearLista(ator: UsuarioAtual, listaId: string, nome: string) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  await exigirLista(ator, listaId);
  await prisma.lista.update({ where: { id: listaId }, data: { nome } });
}

export async function excluirLista(ator: UsuarioAtual, listaId: string) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  await exigirLista(ator, listaId);
  await prisma.lista.update({ where: { id: listaId }, data: { excluidoEm: new Date() } });
}

/** Ajusta concluidaEm das tarefas de um status cujo tipo mudou (regra 4). */
async function ajustarConclusaoDoStatus(tx: Tx, statusId: string, tipoNovo: TipoStatus) {
  if (tipoNovo === "concluido") {
    await tx.tarefa.updateMany({ where: { statusId, concluidaEm: null }, data: { concluidaEm: new Date() } });
  } else {
    await tx.tarefa.updateMany({ where: { statusId }, data: { concluidaEm: null } });
  }
}

type StatusDesejado = { id?: string; nome: string; cor: string; tipo: TipoStatus };

/** Salva o conjunto de status na ordem dada. Remover status é feito por excluirStatus. */
export async function salvarStatus(ator: UsuarioAtual, listaId: string, desejados: StatusDesejado[]) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  await exigirLista(ator, listaId);
  const erro = validarConjuntoStatus(desejados.map((s) => s.tipo));
  if (erro) throw new ErroNegocio(erro);

  await prisma.$transaction(async (tx) => {
    const atuais = await tx.statusLista.findMany({ where: { listaId } });
    const idsDesejados = new Set(desejados.flatMap((s) => (s.id ? [s.id] : [])));
    if (atuais.some((s) => !idsDesejados.has(s.id))) {
      throw new ErroNegocio("Para remover um status, use a opção excluir e escolha o destino das tarefas.");
    }
    for (const [i, s] of desejados.entries()) {
      if (s.id) {
        const atual = atuais.find((a) => a.id === s.id);
        if (!atual) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
        await tx.statusLista.update({ where: { id: s.id }, data: { nome: s.nome, cor: s.cor, tipo: s.tipo, ordem: i + 1 } });
        if (atual.tipo !== s.tipo && (atual.tipo === "concluido" || s.tipo === "concluido")) {
          await ajustarConclusaoDoStatus(tx, s.id, s.tipo);
        }
      } else {
        await tx.statusLista.create({ data: { listaId, nome: s.nome, cor: s.cor, tipo: s.tipo, ordem: i + 1 } });
      }
    }
  });
}

/** Exclui um status movendo as tarefas dele para outro status da mesma lista (regra 3). */
export async function excluirStatus(ator: UsuarioAtual, statusId: string, destinoId: string) {
  exigirPermissaoTarefas(ator, "tarefas:gerenciar_listas");
  if (statusId === destinoId) throw new ErroNegocio("Escolha outro status para receber as tarefas.");
  const status = await prisma.statusLista.findUnique({ where: { id: statusId } });
  if (!status) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  await exigirLista(ator, status.listaId);

  await prisma.$transaction(async (tx) => {
    const todos = await tx.statusLista.findMany({ where: { listaId: status.listaId } });
    const destino = todos.find((s) => s.id === destinoId);
    if (!destino) throw new ErroNegocio("O status de destino precisa ser da mesma lista.");
    const erro = validarConjuntoStatus(todos.filter((s) => s.id !== statusId).map((s) => s.tipo));
    if (erro) throw new ErroNegocio(erro);

    if (destino.tipo === "concluido") {
      await tx.tarefa.updateMany({ where: { statusId, concluidaEm: null }, data: { concluidaEm: new Date() } });
      await tx.tarefa.updateMany({ where: { statusId }, data: { statusId: destinoId } });
    } else {
      await tx.tarefa.updateMany({ where: { statusId }, data: { statusId: destinoId, concluidaEm: null } });
    }
    await tx.statusLista.delete({ where: { id: statusId } });
  });
}
