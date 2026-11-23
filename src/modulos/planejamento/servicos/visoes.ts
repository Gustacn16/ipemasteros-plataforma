import "server-only";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { exigirPermissaoComercial } from "@/modulos/comercial/servicos/acesso";
import { acumular, desempenho, razaoAcumulada, statusDe, type Sentido, type Status, type Tipo } from "../regras/desempenho";
import type { RetratoMes } from "../regras/fechamento";
import { fonteAutomatica, type ChaveMetaCalculada } from "../regras/fontes";
import { mesComecou, mesDaData, mesDoDia, mesesDoAno } from "../regras/meses";
import { totalDoMes, type MetaProdutoMes } from "../regras/turmas";
import { exigir, hojeSp } from "./acesso";
import { carregarPlanoCalculado, type PlanoCalculado } from "./fechamento";
import { idDoPlano } from "./planos";
import { realizadoAutomatico, type BaseMes } from "./realizado";

export type LinhaMes = { mes: string; meta: number | null; realizado: number | null; pct: number | null; status: Status | null; parcial: boolean; comecou: boolean };
export type Resumo = { meta: number | null; realizado: number | null; pct: number | null; status: Status | null };
export type LinhaIndicador = {
  id: string;
  frente: "comercial" | "marketing";
  grupo: string;
  nome: string;
  unidade: "numero" | "reais" | "percentual";
  sentido: Sentido;
  tipo: Tipo;
  automatico: boolean;
  noPainel: boolean;
  responsavel: string | null;
  meses: LinhaMes[];
  mesEscolhido: LinhaMes;
  acumulado: Resumo;
};

/** Meta do mês que o plano calcula (dinheiro em reais, conversão em fração). Zero = sem meta. */
function metaCalculadaDo(chave: ChaveMetaCalculada, r: RetratoMes): number | null {
  const f = r.funil;
  const v = (() => {
    switch (chave) {
      case "vendas_valor":
        return f.valorCentavos / 100;
      case "vendas_alunos":
        return f.alunos;
      case "leads":
        return f.leads;
      case "reunioes_agendadas":
        return f.reunioesAgendadas;
      case "reunioes_realizadas":
        return f.reunioesRealizadas;
      case "investimento_midia":
        return f.verbaCentavos === null ? null : f.verbaCentavos / 100;
      case "cac_por_aluno":
        return f.cacPorAlunoCentavos === null ? null : f.cacPorAlunoCentavos / 100;
      case "conversao_lead_venda":
        return f.leads ? f.alunos / f.leads : null;
    }
  })();
  return v === 0 ? null : v;
}

const resumo = (meta: number | null, realizado: number | null, sentido: Sentido): Resumo => {
  const pct = desempenho(realizado, meta, sentido);
  return { meta, realizado, pct, status: statusDe(pct) };
};

/** Acumulado de CAC e conversão: soma os componentes antes de dividir. */
function acumuladoComposto(chave: string, meses: string[], calc: PlanoCalculado, base: Record<string, BaseMes>): { meta: number | null; realizado: number | null } | null {
  const funis = meses.map((m) => calc.porMes[m].funil);
  const reais = meses.map((m) => base[m]);
  if (chave === "cac_por_aluno") {
    return {
      meta: razaoAcumulada(funis.map((f) => ({ num: (f.cacTotalCentavos ?? 0) / 100, den: f.alunos }))),
      realizado: razaoAcumulada(reais.map((b) => ({ num: (b.investimentoCentavos + b.vendasCentavos * calc.premissasFunil.comissaoPct) / 100, den: b.alunos }))),
    };
  }
  if (chave === "conversao_lead_venda") {
    return {
      meta: razaoAcumulada(funis.map((f) => ({ num: f.alunos, den: f.leads ?? 0 }))),
      realizado: razaoAcumulada(reais.map((b) => ({ num: b.alunos, den: b.leads }))),
    };
  }
  return null;
}

async function montar(planoId: string, mesEscolhido: string) {
  const hoje = hojeSp();
  const calc = await carregarPlanoCalculado(planoId, hoje);
  const indicadores = await prisma.indicadorPlano.findMany({
    where: { planoId, excluidoEm: null },
    orderBy: [{ frente: "asc" }, { ordem: "asc" }],
    include: { responsavel: { select: { nome: true } }, metas: { select: { mes: true, valor: true } }, realizados: { select: { mes: true, valor: true } } },
  });
  const { porIndicador, base } = await realizadoAutomatico(
    { ano: calc.plano.ano, comissaoPct: calc.premissasFunil.comissaoPct, produtosDoPlano: calc.produtosDoPlano },
    indicadores,
    hoje,
  );
  const meses = mesesDoAno(calc.plano.ano);
  const atual = mesDoDia(hoje);
  const ateEscolhido = meses.filter((m) => m <= mesEscolhido && mesComecou(m, hoje));

  const linhas: LinhaIndicador[] = indicadores.map((i) => {
    const sentido = i.sentido as Sentido;
    const tipo = i.tipo as Tipo;
    const metasDigitadas = Object.fromEntries(i.metas.map((m) => [mesDaData(m.mes), m.valor.toNumber()]));
    const lancados = Object.fromEntries(i.realizados.map((r) => [mesDaData(r.mes), r.valor.toNumber()]));
    const automatico = fonteAutomatica(i.fonte);
    const linhaMeses: LinhaMes[] = meses.map((mes) => {
      const meta = i.metaCalculada ? metaCalculadaDo(i.metaCalculada as ChaveMetaCalculada, calc.porMes[mes]) : (metasDigitadas[mes] ?? null);
      const comecou = mesComecou(mes, hoje);
      const realizado = !comecou ? null : automatico ? (porIndicador[i.id]?.[mes] ?? null) : (lancados[mes] ?? null);
      const r = comecou ? resumo(meta, realizado, sentido) : { meta, realizado: null, pct: null, status: null };
      return { mes, ...r, parcial: mes === atual, comecou };
    });
    const doPeriodo = linhaMeses.filter((l) => ateEscolhido.includes(l.mes));
    const acc = (i.metaCalculada && acumuladoComposto(i.metaCalculada, ateEscolhido, calc, base)) || acumular(tipo, doPeriodo);
    return {
      id: i.id,
      frente: i.frente,
      grupo: i.grupo,
      nome: i.nome,
      unidade: i.unidade,
      sentido,
      tipo,
      automatico,
      noPainel: i.noPainel,
      responsavel: i.responsavel?.nome ?? null,
      meses: linhaMeses,
      mesEscolhido: linhaMeses.find((l) => l.mes === mesEscolhido) ?? linhaMeses[0],
      acumulado: resumo(acc.meta === 0 ? null : acc.meta, acc.realizado, sentido),
    };
  });
  return { calc, linhas, base, meses, hoje };
}

export async function obterPainel(ator: UsuarioAtual, ano: number, mes: string) {
  exigir(ator, "planejamento:ver");
  const planoId = await idDoPlano(ano);
  if (!planoId) return null;
  const { linhas, calc, base, meses, hoje } = await montar(planoId, mes);
  const noPainel = linhas.filter((l) => l.noPainel);
  const comDado = noPainel.filter((l) => l.mesEscolhido.status !== null);
  return {
    ano,
    mes,
    statusGeral: { noCaminho: comDado.filter((l) => l.mesEscolhido.status === "ok").length, comDado: comDado.length, total: noPainel.length },
    linhas: noPainel,
    graficoVendas: meses.map((m) => ({
      mes: m,
      meta: calc.porMes[m].funil.valorCentavos / 100,
      realizado: mesComecou(m, hoje) ? base[m].vendasCentavos / 100 : null,
    })),
    graficoLeads: meses.map((m) => ({ mes: m, meta: calc.porMes[m].funil.leads ?? 0, realizado: mesComecou(m, hoje) ? base[m].leads : null })),
  };
}
export type DadosPainel = NonNullable<Awaited<ReturnType<typeof obterPainel>>>;

const somarMetas = (a: MetaProdutoMes | undefined) => a ?? { alunos: 0, valorCentavos: 0 };

export async function obterPlanoComercial(ator: UsuarioAtual, ano: number, mes: string) {
  exigir(ator, "planejamento:ver");
  const planoId = await idDoPlano(ano);
  if (!planoId) return null;
  const { linhas, calc, meses } = await montar(planoId, mes);
  const produtos = await prisma.produto.findMany({ where: { id: { in: calc.produtosDoPlano } }, select: { id: true, nome: true } });
  const linhasProdutos = produtos
    .map((p) => {
      const porMes = meses.map((m) => somarMetas(calc.porMes[m].produtos[p.id]));
      return {
        produtoId: p.id,
        produto: p.nome,
        antes: somarMetas(calc.antes[p.id]),
        meses: porMes,
        depois: somarMetas(calc.depois[p.id]),
        total: totalDoMes(Object.fromEntries(porMes.map((v, i) => [String(i), v]))),
      };
    })
    .sort((a, b) => b.total.valorCentavos - a.total.valorCentavos);
  return {
    ano,
    mes,
    meses,
    congelados: calc.congelados,
    produtos: linhasProdutos,
    funil: meses.map((m) => ({ mes: m, ...calc.porMes[m].funil })),
    tetoCacPct: calc.premissasFunil.tetoCacPct,
    linhas: linhas.filter((l) => l.frente === "comercial"),
  };
}
export type DadosPlanoComercial = NonNullable<Awaited<ReturnType<typeof obterPlanoComercial>>>;

export async function obterPlanoMarketing(ator: UsuarioAtual, ano: number, mes: string) {
  exigir(ator, "planejamento:ver");
  const planoId = await idDoPlano(ano);
  if (!planoId) return null;
  const { linhas, meses } = await montar(planoId, mes);
  const mkt = linhas.filter((l) => l.frente === "marketing");
  const grupos: { grupo: string; linhas: LinhaIndicador[] }[] = [];
  for (const l of mkt) {
    let g = grupos.find((x) => x.grupo === l.grupo);
    if (!g) {
      g = { grupo: l.grupo, linhas: [] };
      grupos.push(g);
    }
    g.linhas.push(l);
  }
  const batidos = meses.map((m, idx) => {
    const comStatus = mkt.map((l) => l.meses[idx].status).filter((s): s is Status => s !== null);
    return { mes: m, pct: comStatus.length ? comStatus.filter((s) => s === "ok").length / comStatus.length : null };
  });
  return { ano, mes, meses, grupos, batidos };
}
export type DadosPlanoMarketing = NonNullable<Awaited<ReturnType<typeof obterPlanoMarketing>>>;

/** Meta do plano por produto no mês, para a tela de Metas do Comercial. Sem plano no ano → null. */
export async function obterPlanoDoMesParaMetas(ator: UsuarioAtual, mes: string): Promise<Record<string, MetaProdutoMes> | null> {
  exigirPermissaoComercial(ator, "comercial:gerenciar_metas");
  const planoId = await idDoPlano(Number(mes.slice(0, 4)));
  if (!planoId) return null;
  const calc = await carregarPlanoCalculado(planoId, hojeSp());
  return calc.porMes[mes]?.produtos ?? {};
}
