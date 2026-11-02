// Regras puras de período, lote e grade da Agenda. Dias "AAAA-MM-DD"; horas
// "HH:MM" em São Paulo (UTC−3 fixo).
import { proximoMes, mesAnterior } from "@/modulos/conteudo/regras/calendario";
import { somarDias } from "@/modulos/tarefas/regras/prazo";

export { gradeDoMes, type DiaGrade } from "@/modulos/conteudo/regras/calendario";

export type Periodo = {
  dataInicio: string;
  dataFim: string;
  horaInicio: string | null;
  horaFim: string | null;
};

export const MAX_DIAS_EVENTO = 31;
export const MAX_LOTE = 30;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIA_MS = 86_400_000;

function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / DIA_MS);
}

export function validarPeriodo(p: Periodo): string | null {
  if ((p.horaInicio === null) !== (p.horaFim === null)) return "Informe as duas horas ou nenhuma.";
  if ((p.horaInicio !== null && !HORA.test(p.horaInicio)) || (p.horaFim !== null && !HORA.test(p.horaFim))) {
    return "Hora inválida.";
  }
  if (p.dataFim < p.dataInicio) return "A data final não pode ser antes da inicial.";
  if (diasEntre(p.dataInicio, p.dataFim) + 1 > MAX_DIAS_EVENTO) return "Um evento dura no máximo 31 dias.";
  if (p.dataInicio === p.dataFim && p.horaInicio !== null && p.horaFim !== null && p.horaFim <= p.horaInicio) {
    return "A hora final precisa ser depois da inicial.";
  }
  return null;
}

export function ordenarLote(periodos: Periodo[]): Periodo[] {
  return [...periodos].sort(
    (a, b) => a.dataInicio.localeCompare(b.dataInicio) || (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""),
  );
}

export function titulosDoLote(base: string, quantidade: number, numerar: boolean): string[] {
  return Array.from({ length: quantidade }, (_, i) => (numerar ? `${base} — ${i + 1}` : base));
}

/** O sábado a partir de `dia` (o próprio, se for sábado) e o domingo seguinte. */
export function periodoPadraoFimDeSemana(dia: string): { dataInicio: string; dataFim: string } {
  const diaDaSemana = new Date(`${dia}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const sabado = somarDias(dia, (6 - diaDaSemana + 7) % 7);
  return { dataInicio: sabado, dataFim: somarDias(sabado, 1) };
}

function emInstante(dia: string, hora: string): Date {
  // São Paulo é UTC−3: o instante UTC é 3 h depois do relógio local.
  return new Date(Date.parse(`${dia}T${hora}:00Z`) + 3 * 3_600_000);
}

export function instanteInicio(p: Periodo): Date {
  return emInstante(p.dataInicio, p.horaInicio ?? "00:00");
}

export function instanteFim(p: Periodo): Date {
  return p.horaFim === null ? emInstante(somarDias(p.dataFim, 1), "00:00") : emInstante(p.dataFim, p.horaFim);
}

export type ItemFaixa = { id: string; inicio: string; fim: string };

export type Faixa<T extends ItemFaixa> = {
  item: T;
  coluna: number;
  largura: number;
  linha: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
};

/** Distribui os itens em faixas (colunas e linhas) de uma semana de 7 dias. */
export function faixasDaSemana<T extends ItemFaixa>(semana: string[], itens: T[]): Faixa<T>[] {
  const primeiro = semana[0];
  const ultimo = semana[semana.length - 1];
  const recortados = itens
    .filter((item) => item.inicio <= ultimo && item.fim >= primeiro)
    .map((item) => {
      const inicio = item.inicio < primeiro ? primeiro : item.inicio;
      const fim = item.fim > ultimo ? ultimo : item.fim;
      return {
        item,
        coluna: diasEntre(primeiro, inicio),
        largura: diasEntre(inicio, fim) + 1,
        continuaAntes: item.inicio < primeiro,
        continuaDepois: item.fim > ultimo,
      };
    })
    .sort((a, b) => a.coluna - b.coluna || b.largura - a.largura || a.item.id.localeCompare(b.item.id));

  const linhas: { coluna: number; largura: number }[][] = [];
  return recortados.map((r) => {
    let linha = linhas.findIndex((ocupadas) =>
      ocupadas.every((o) => r.coluna >= o.coluna + o.largura || r.coluna + r.largura <= o.coluna),
    );
    if (linha === -1) {
      linha = linhas.length;
      linhas.push([]);
    }
    linhas[linha].push({ coluna: r.coluna, largura: r.largura });
    return { ...r, linha };
  });
}

/** Domingo a sábado da semana que contém `dia`. */
export function diasDaSemana(dia: string): string[] {
  const domingo = somarDias(dia, -new Date(`${dia}T00:00:00Z`).getUTCDay());
  return Array.from({ length: 7 }, (_, i) => somarDias(domingo, i));
}

export type VisaoAgenda = "mes" | "semana" | "lista";

export function navegar(visao: VisaoAgenda, dia: string, passo: 1 | -1): string {
  if (visao === "mes") {
    const mes = dia.slice(0, 7);
    return `${passo === 1 ? proximoMes(mes) : mesAnterior(mes)}-01`;
  }
  return somarDias(dia, (visao === "semana" ? 7 : 60) * passo);
}
