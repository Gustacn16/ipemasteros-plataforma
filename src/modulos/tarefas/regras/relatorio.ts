// Regras de data do relatório de tarefas (spec F1a, seção 8). O Brasil não tem
// horário de verão desde 2019, então São Paulo é UTC−3 fixo.
import { diaDaDataEntrega, diaEmSaoPaulo, somarDias } from "./prazo";

export const PERIODOS = ["semana", "mes", "mes_passado", "intervalo"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const ROTULO_PERIODO: Record<Periodo, string> = {
  semana: "Esta semana",
  mes: "Este mês",
  mes_passado: "Mês passado",
  intervalo: "Intervalo livre",
};

/** Instante UTC da meia-noite de um dia ("AAAA-MM-DD") em São Paulo. */
export function inicioDoDiaSaoPaulo(dia: string): Date {
  return new Date(`${dia}T03:00:00Z`);
}

/** Último instante (23:59:59.999 em São Paulo) do dia de entrega. */
export function fimDoDiaEntrega(dataEntrega: Date): Date {
  return new Date(inicioDoDiaSaoPaulo(somarDias(diaDaDataEntrega(dataEntrega), 1)).getTime() - 1);
}

export type SituacaoPrazo = "no_prazo" | "atrasada" | "sem_data";

export const ROTULO_SITUACAO_PRAZO: Record<SituacaoPrazo, string> = {
  no_prazo: "No prazo",
  atrasada: "Atrasada",
  sem_data: "Sem data",
};

/**
 * Concluída: no prazo se `concluidaEm` ≤ fim do dia da entrega em São Paulo.
 * Aberta: atrasada se a entrega é anterior a hoje.
 */
export function situacaoPrazo(dataEntrega: Date | null, concluidaEm: Date | null, agora: Date): SituacaoPrazo {
  if (!dataEntrega) return "sem_data";
  if (concluidaEm) return concluidaEm <= fimDoDiaEntrega(dataEntrega) ? "no_prazo" : "atrasada";
  return diaDaDataEntrega(dataEntrega) < diaEmSaoPaulo(agora) ? "atrasada" : "no_prazo";
}

/** No prazo ÷ entregues com data, em % inteiro; `null` sem divisor. */
export function percentualNoPrazo(noPrazo: number, entreguesComData: number): number | null {
  return entreguesComData === 0 ? null : Math.round((noPrazo / entreguesComData) * 100);
}

export type FaixaPercentual = "verde" | "amarelo" | "vermelho";

export function faixaPercentual(percentual: number | null): FaixaPercentual | null {
  if (percentual === null) return null;
  if (percentual >= 80) return "verde";
  if (percentual >= 60) return "amarelo";
  return "vermelho";
}

export type FiltroPeriodo = { periodo: Periodo; de?: string; ate?: string };

export type Intervalo = {
  periodo: Periodo;
  primeiroDia: string;
  ultimoDia: string;
  /** Início inclusivo (UTC). */
  inicio: Date;
  /** Fim exclusivo (UTC): meia-noite em São Paulo do dia seguinte ao último. */
  fim: Date;
};

function intervaloDeDias(periodo: Periodo, primeiroDia: string, ultimoDia: string): Intervalo {
  return {
    periodo,
    primeiroDia,
    ultimoDia,
    inicio: inicioDoDiaSaoPaulo(primeiroDia),
    fim: inicioDoDiaSaoPaulo(somarDias(ultimoDia, 1)),
  };
}

function primeiroDiaDoMes(dia: string, deslocamentoMeses: number): string {
  const data = new Date(`${dia.slice(0, 7)}-01T00:00:00Z`);
  data.setUTCMonth(data.getUTCMonth() + deslocamentoMeses);
  return data.toISOString().slice(0, 10);
}

/** Converte o filtro de período em dias e instantes UTC. Intervalo livre inválido vira "este mês". */
export function intervaloDoPeriodo(filtro: FiltroPeriodo, agora: Date): Intervalo {
  const hoje = diaEmSaoPaulo(agora);
  switch (filtro.periodo) {
    case "semana": {
      // Semana de segunda a domingo.
      const recuo = (new Date(`${hoje}T00:00:00Z`).getUTCDay() + 6) % 7;
      const segunda = somarDias(hoje, -recuo);
      return intervaloDeDias("semana", segunda, somarDias(segunda, 6));
    }
    case "mes_passado": {
      const inicio = primeiroDiaDoMes(hoje, -1);
      return intervaloDeDias("mes_passado", inicio, somarDias(primeiroDiaDoMes(hoje, 0), -1));
    }
    case "intervalo":
      if (filtro.de && filtro.ate && filtro.de <= filtro.ate) return intervaloDeDias("intervalo", filtro.de, filtro.ate);
      return intervaloDoPeriodo({ periodo: "mes" }, agora);
    case "mes": {
      const inicio = primeiroDiaDoMes(hoje, 0);
      return intervaloDeDias("mes", inicio, somarDias(primeiroDiaDoMes(hoje, 1), -1));
    }
  }
}

type Pessoa = { id: string; nome: string };
type TarefaContada = { dataEntrega: Date | null; concluidaEm: Date | null; responsaveis: Pessoa[] };

export type LinhaRelatorio = {
  pessoa: Pessoa;
  abertas: number;
  atrasadas: number;
  entregues: number;
  entreguesComData: number;
  noPrazo: number;
  percentual: number | null;
};

export function linhaVazia(pessoa: Pessoa): LinhaRelatorio {
  return { pessoa, abertas: 0, atrasadas: 0, entregues: 0, entreguesComData: 0, noPrazo: 0, percentual: null };
}

/**
 * Uma linha por responsável. `abertas` são as tarefas sem `concluidaEm` (agora);
 * `entregues`, as concluídas no período. Vários responsáveis: conta para cada um.
 */
export function resumirPorPessoa(abertas: TarefaContada[], entregues: TarefaContada[], agora: Date): LinhaRelatorio[] {
  const linhas = new Map<string, LinhaRelatorio>();
  const linhaDe = (pessoa: Pessoa) => {
    let linha = linhas.get(pessoa.id);
    if (!linha) linhas.set(pessoa.id, (linha = linhaVazia(pessoa)));
    return linha;
  };

  for (const t of abertas) {
    const atrasada = situacaoPrazo(t.dataEntrega, null, agora) === "atrasada";
    for (const p of t.responsaveis) {
      const linha = linhaDe(p);
      linha.abertas++;
      if (atrasada) linha.atrasadas++;
    }
  }
  for (const t of entregues) {
    const situacao = situacaoPrazo(t.dataEntrega, t.concluidaEm, agora);
    for (const p of t.responsaveis) {
      const linha = linhaDe(p);
      linha.entregues++;
      if (situacao !== "sem_data") linha.entreguesComData++;
      if (situacao === "no_prazo") linha.noPrazo++;
    }
  }

  return [...linhas.values()]
    .map((l) => ({ ...l, percentual: percentualNoPrazo(l.noPrazo, l.entreguesComData) }))
    .sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR"));
}

function diasEntre(primeiroDia: string, ultimoDia: string): number {
  return Math.round((Date.parse(`${ultimoDia}T00:00:00Z`) - Date.parse(`${primeiroDia}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Intervalo imediatamente anterior, do mesmo tipo, para comparar com o atual. */
export function intervaloAnterior(i: Intervalo): Intervalo {
  if (i.periodo === "mes" || i.periodo === "mes_passado") {
    const inicio = primeiroDiaDoMes(i.primeiroDia, -1);
    return intervaloDeDias(i.periodo, inicio, somarDias(i.primeiroDia, -1));
  }
  const n = i.periodo === "semana" ? 7 : diasEntre(i.primeiroDia, i.ultimoDia);
  return intervaloDeDias(i.periodo, somarDias(i.primeiroDia, -n), somarDias(i.primeiroDia, -1));
}

/** Variação percentual inteira; `null` sem base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : Math.round(((atual - anterior) / anterior) * 100);
}

/** Diferença em pontos percentuais; `null` se faltar algum dos lados. */
export function variacaoPontos(atual: number | null, anterior: number | null): number | null {
  return atual === null || anterior === null ? null : atual - anterior;
}

export type Balde = { inicio: string; fim: string; rotulo: string };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MAXIMO_SEMANAS = 13;

/** Semanas (seg–dom) recortadas ao intervalo; acima de 13 semanas, meses. */
export function baldesDoIntervalo(i: Intervalo): Balde[] {
  const semanas: Balde[] = [];
  const recuo = (new Date(`${i.primeiroDia}T00:00:00Z`).getUTCDay() + 6) % 7;
  for (let segunda = somarDias(i.primeiroDia, -recuo); segunda <= i.ultimoDia; segunda = somarDias(segunda, 7)) {
    const inicio = segunda < i.primeiroDia ? i.primeiroDia : segunda;
    const domingo = somarDias(segunda, 6);
    const fim = domingo > i.ultimoDia ? i.ultimoDia : domingo;
    semanas.push({ inicio, fim, rotulo: `${inicio.slice(8, 10)}/${inicio.slice(5, 7)}` });
  }
  if (semanas.length <= MAXIMO_SEMANAS) return semanas;

  const meses: Balde[] = [];
  for (let mes = primeiroDiaDoMes(i.primeiroDia, 0); mes <= i.ultimoDia; mes = primeiroDiaDoMes(mes, 1)) {
    const ultimoDoMes = somarDias(primeiroDiaDoMes(mes, 1), -1);
    meses.push({
      inicio: mes < i.primeiroDia ? i.primeiroDia : mes,
      fim: ultimoDoMes > i.ultimoDia ? i.ultimoDia : ultimoDoMes,
      rotulo: `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`,
    });
  }
  return meses;
}

/** Conta as entregas por balde (dia de conclusão em São Paulo) e situação do prazo. */
export function distribuirPorBalde(
  entregues: { dataEntrega: Date | null; concluidaEm: Date }[],
  baldes: Balde[],
): { rotulo: string; noPrazo: number; atrasadas: number; semData: number }[] {
  const resultado = baldes.map((b) => ({ rotulo: b.rotulo, noPrazo: 0, atrasadas: 0, semData: 0 }));
  for (const e of entregues) {
    const diaConclusao = diaEmSaoPaulo(e.concluidaEm);
    const posicao = baldes.findIndex((b) => b.inicio <= diaConclusao && diaConclusao <= b.fim);
    if (posicao < 0) continue;
    const situacao = situacaoPrazo(e.dataEntrega, e.concluidaEm, e.concluidaEm);
    if (situacao === "no_prazo") resultado[posicao].noPrazo++;
    else if (situacao === "atrasada") resultado[posicao].atrasadas++;
    else resultado[posicao].semData++;
  }
  return resultado;
}

/** Até 3 pessoas com mais entregas no prazo; desempata por percentual e nome. */
export function podio(linhas: LinhaRelatorio[]): LinhaRelatorio[] {
  return linhas
    .filter((l) => l.noPrazo > 0)
    .sort(
      (a, b) =>
        b.noPrazo - a.noPrazo ||
        (b.percentual ?? -1) - (a.percentual ?? -1) ||
        a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR"),
    )
    .slice(0, 3);
}
