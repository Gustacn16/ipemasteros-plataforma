import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosLancamento } from "../esquemas/planejamento";
import { validarLancamento } from "../regras/lancamento";
import { dataDoMes } from "../regras/meses";
import { exigir, hojeSp, podeEditar, podeLancar } from "./acesso";
import { paraBanco, paraTela } from "./indicadores";

/** Tem algum indicador manual sob sua responsabilidade num plano? (menu e acesso ao lançamento) */
export async function ehResponsavelNoPlanejamento(usuarioId: string): Promise<boolean> {
  const n = await prisma.indicadorPlano.count({ where: { responsavelId: usuarioId, excluidoEm: null, fonte: "manual" } });
  return n > 0;
}

/** Indicadores manuais do mês para lançar. A gestão vê todos; os outros, só os seus. */
export async function listarParaLancar(ator: UsuarioAtual, ano: number, mes: string) {
  exigir(ator, "planejamento:lancar");
  const lista = await prisma.indicadorPlano.findMany({
    where: { plano: { ano }, excluidoEm: null, fonte: "manual", ...(podeEditar(ator) ? {} : { responsavelId: ator.id }) },
    orderBy: [{ frente: "asc" }, { ordem: "asc" }],
    select: {
      id: true,
      frente: true,
      grupo: true,
      nome: true,
      unidade: true,
      responsavel: { select: { nome: true } },
      metas: { where: { mes: dataDoMes(mes) }, select: { valor: true } },
      realizados: { where: { mes: dataDoMes(mes) }, select: { valor: true, observacao: true, registradoPor: { select: { nome: true } }, atualizadoEm: true } },
    },
  });
  return lista.map((i) => {
    const r = i.realizados[0];
    return {
      id: i.id,
      frente: i.frente,
      grupo: i.grupo,
      nome: i.nome,
      unidade: i.unidade,
      responsavel: i.responsavel?.nome ?? null,
      meta: i.metas[0] ? paraTela(i.unidade, i.metas[0].valor.toNumber()) : null,
      valor: r ? paraTela(i.unidade, r.valor.toNumber()) : null,
      observacao: r?.observacao ?? null,
      registradoPor: r?.registradoPor.nome ?? null,
      atualizadoEm: r?.atualizadoEm ?? null,
    };
  });
}
export type ItemLancamento = Awaited<ReturnType<typeof listarParaLancar>>[number];

/** Grava (ou apaga, com valor vazio) o resultado de um mês. */
export async function lancarResultado(ator: UsuarioAtual, d: DadosLancamento) {
  const ind = await prisma.indicadorPlano.findFirst({
    where: { id: d.indicadorId, excluidoEm: null },
    select: { responsavelId: true, fonte: true, unidade: true, plano: { select: { ano: true } } },
  });
  if (!ind) throw new ErroNegocio("Indicador não encontrado.");
  if (!podeLancar(ator, ind.responsavelId)) throw new ErroPermissao("planejamento:lancar");
  if (!d.mes.startsWith(`${ind.plano.ano}-`)) throw new ErroNegocio("Esse mês não é do plano.");
  const erro = validarLancamento({ mes: d.mes, hoje: hojeSp(), fonte: ind.fonte });
  if (erro) throw new ErroNegocio(erro);
  const mes = dataDoMes(d.mes);
  await prisma.$transaction(async (tx) => {
    if (d.valor === null) {
      await tx.realizadoMensalIndicador.deleteMany({ where: { indicadorId: d.indicadorId, mes } });
    } else {
      const dados = { valor: paraBanco(ind.unidade, d.valor), observacao: d.observacao, registradoPorId: ator.id };
      await tx.realizadoMensalIndicador.upsert({
        where: { indicadorId_mes: { indicadorId: d.indicadorId, mes } },
        create: { indicadorId: d.indicadorId, mes, ...dados },
        update: dados,
      });
    }
    await registrarAuditoria(
      { usuarioId: ator.id, acao: "planejamento.realizado_lancado", entidade: "IndicadorPlano", entidadeId: d.indicadorId, diff: { mes: d.mes, apagado: d.valor === null } },
      tx,
    );
  });
}
