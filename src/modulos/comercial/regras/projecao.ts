// Projeção de fechamento do mês no dashboard comercial. Dinheiro em centavos.
//
// Duas contas, lado a lado:
// - Pelo ritmo: o vendido até hoje esticado para o mês inteiro.
// - Pelos leads: o vendido até hoje + os leads que ainda devem chegar no mês
//   (no ritmo de leads do mês) × a conversão média dos últimos meses × o ticket
//   médio desses meses.
// A projeção principal é a dos leads quando há base para ela; senão, a do ritmo.

export type MesHistorico = { mes: string; vendido: number; vendas: number; leads: number | null };

export type EntradaProjecao = {
  mes: string;
  /** Hoje no fuso de São Paulo, "AAAA-MM-DD". */
  hoje: string;
  vendido: number;
  vendas: number;
  meta: number;
  /** Leads do mês até hoje; `null` quando a pessoa não vê mídia ou há filtro de produto/vendedor. */
  leads: number | null;
  /** Meses anteriores usados como base (normalmente 6). */
  historico: MesHistorico[];
};

export type Situacao = "passado" | "andamento" | "futuro";

export type Projecao = {
  situacao: Situacao;
  diasDoMes: number;
  diasPassados: number;
  diasRestantes: number;
  /** Projeção principal (centavos); no mês fechado é o próprio vendido. `null` no mês futuro. */
  valor: number | null;
  origem: "leads" | "ritmo" | "fechado" | null;
  percentual: number | null;
  /** Projeção − meta (positivo = acima). `null` sem meta ou sem projeção. */
  diferenca: number | null;
  ritmo: number | null;
  pelosLeads: number | null;
  vendasProjetadas: number | null;
  falta: number;
  faltaPorDia: number | null;
  /** Leads do mês até hoje (`null` sem leads na conta). */
  leads: number | null;
  leadsProjetados: number | null;
  leadsNecessarios: number | null;
  base: {
    meses: number;
    vendas: number;
    leads: number;
    vendido: number;
    /** Vendas ÷ leads (0 a 1, ou mais quando há muita venda fora da mídia). */
    conversao: number | null;
    ticket: number | null;
  };
};

export function diasNoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano!, m!, 0)).getUTCDate();
}

function situacaoDoMes(mes: string, hoje: string): Situacao {
  const atual = hoje.slice(0, 7);
  return mes < atual ? "passado" : mes > atual ? "futuro" : "andamento";
}

export function projetarMes(e: EntradaProjecao): Projecao {
  const diasDoMes = diasNoMes(e.mes);
  const situacao = situacaoDoMes(e.mes, e.hoje);
  const diasPassados = situacao === "passado" ? diasDoMes : situacao === "futuro" ? 0 : Number(e.hoje.slice(8, 10));
  const diasRestantes = diasDoMes - diasPassados;

  // Base: só meses que têm leads registrados, para a conversão comparar coisas do mesmo período.
  const comLeads = e.historico.filter((h) => h.leads !== null && h.leads > 0);
  const base = {
    meses: comLeads.length,
    vendas: comLeads.reduce((s, h) => s + h.vendas, 0),
    leads: comLeads.reduce((s, h) => s + (h.leads ?? 0), 0),
    vendido: comLeads.reduce((s, h) => s + h.vendido, 0),
    conversao: null as number | null,
    ticket: null as number | null,
  };
  if (base.leads > 0 && base.vendas > 0) base.conversao = base.vendas / base.leads;
  if (base.vendas > 0) base.ticket = Math.round(base.vendido / base.vendas);
  // Ticket também sem leads (ritmo e "falta por dia" não dependem dele, mas a tela mostra).
  if (base.ticket === null) {
    const vendas = e.historico.reduce((s, h) => s + h.vendas, 0);
    if (vendas > 0) base.ticket = Math.round(e.historico.reduce((s, h) => s + h.vendido, 0) / vendas);
  }

  let ritmo: number | null = null;
  let pelosLeads: number | null = null;
  let vendasProjetadas: number | null = null;
  let leadsProjetados: number | null = null;
  if (situacao === "andamento" && diasPassados > 0) {
    ritmo = Math.round((e.vendido / diasPassados) * diasDoMes);
    if (e.leads !== null && base.conversao !== null && base.ticket !== null) {
      leadsProjetados = Math.round((e.leads / diasPassados) * diasDoMes);
      const novasVendas = Math.max(leadsProjetados - e.leads, 0) * base.conversao;
      vendasProjetadas = Math.round((e.vendas + novasVendas) * 10) / 10;
      pelosLeads = Math.round(e.vendido + novasVendas * base.ticket);
    }
  }

  const valor = situacao === "passado" ? e.vendido : situacao === "futuro" ? null : (pelosLeads ?? ritmo);
  const origem: Projecao["origem"] = situacao === "passado" ? "fechado" : pelosLeads !== null ? "leads" : ritmo !== null ? "ritmo" : null;
  const falta = Math.max(e.meta - e.vendido, 0);
  const leadsNecessarios =
    situacao === "andamento" && falta > 0 && base.conversao !== null && base.ticket !== null && e.leads !== null
      ? Math.ceil(falta / (base.conversao * base.ticket))
      : null;

  return {
    situacao,
    diasDoMes,
    diasPassados,
    diasRestantes,
    valor,
    origem,
    percentual: valor !== null && e.meta > 0 ? Math.round((valor / e.meta) * 100) : null,
    diferenca: valor !== null && e.meta > 0 ? valor - e.meta : null,
    ritmo,
    pelosLeads,
    vendasProjetadas,
    falta,
    faltaPorDia: situacao !== "passado" && diasRestantes > 0 && falta > 0 ? Math.ceil(falta / diasRestantes) : null,
    leads: e.leads,
    leadsProjetados,
    leadsNecessarios,
    base,
  };
}
