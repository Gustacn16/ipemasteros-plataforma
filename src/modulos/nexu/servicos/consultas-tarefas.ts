import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { filtroTarefasVisiveis } from "@/modulos/tarefas/servicos/acesso";
import { diaDaDataEntrega, diaEmSaoPaulo, estaAtrasada } from "@/modulos/tarefas/regras/prazo";

export type FiltroBuscaTarefas = {
  escopo: "minhas" | "visiveis";
  atrasadas?: boolean;
  responsavelId?: string;
  listaId?: string;
  entregaDe?: string;
  entregaAte?: string;
  incluirConcluidas?: boolean;
};

const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Tarefas que o ator pode ver, em formato compacto para o Nexu (sem descrição, sem dados pessoais). */
export async function buscarTarefasParaNexu(ator: UsuarioAtual, filtro: FiltroBuscaTarefas) {
  const agora = new Date();
  const hoje = diaEmSaoPaulo(agora);
  const entrega = {
    ...(filtro.atrasadas ? { lt: dia(hoje) } : {}),
    ...(filtro.entregaDe ? { gte: dia(filtro.entregaDe) } : {}),
    ...(filtro.entregaAte ? { lte: dia(filtro.entregaAte) } : {}),
  };
  const linhas = await prisma.tarefa.findMany({
    where: {
      AND: [
        filtroTarefasVisiveis(ator),
        filtro.escopo === "minhas" ? { responsaveis: { some: { usuarioId: ator.id } } } : {},
        filtro.responsavelId ? { responsaveis: { some: { usuarioId: filtro.responsavelId } } } : {},
        filtro.listaId ? { listaId: filtro.listaId } : {},
        Object.keys(entrega).length ? { dataEntrega: entrega } : {},
        filtro.atrasadas || !filtro.incluirConcluidas ? { concluidaEm: null } : {},
      ],
    },
    orderBy: [{ dataEntrega: "asc" }, { criadoEm: "asc" }],
    select: {
      id: true,
      titulo: true,
      dataEntrega: true,
      concluidaEm: true,
      statusId: true,
      listaId: true,
      status: { select: { nome: true } },
      lista: { select: { nome: true, espaco: { select: { nome: true } } } },
      responsaveis: { select: { usuario: { select: { nome: true } } } },
    },
  });
  return linhas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    // Os ids vão junto para o modelo poder propor criar tarefa na mesma lista ou mudar o status.
    listaId: t.listaId,
    lista: t.lista.nome,
    espaco: t.lista.espaco.nome,
    statusId: t.statusId,
    status: t.status.nome,
    responsaveis: t.responsaveis.map((r) => r.usuario.nome),
    dataEntrega: t.dataEntrega ? diaDaDataEntrega(t.dataEntrega) : null,
    atrasada: estaAtrasada(t.dataEntrega, t.concluidaEm, agora),
  }));
}
