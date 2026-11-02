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
