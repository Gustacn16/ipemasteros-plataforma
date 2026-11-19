import type { Tom } from "@/componentes/regras-visuais";

// Itens de controle (Falconi): período, farol e atraso. Períodos são strings
// "aaaa-mm-dd" com o primeiro dia (segunda-feira, dia 1 do mês ou do trimestre).

export const FREQUENCIAS = ["semanal", "mensal", "trimestral"] as const;
export type Frequencia = (typeof FREQUENCIAS)[number];
export const ROTULO_FREQUENCIA: Record<Frequencia, string> = { semanal: "Semanal", mensal: "Mensal", trimestral: "Trimestral" };

export const SENTIDOS = ["maior_melhor", "menor_melhor"] as const;
export type Sentido = (typeof SENTIDOS)[number];
export const ROTULO_SENTIDO: Record<Sentido, string> = {
  maior_melhor: "Quanto maior, melhor",
  menor_melhor: "Quanto menor, melhor",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const paraData = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const paraDia = (d: Date) => d.toISOString().slice(0, 10);

/** Primeiro dia do período que contém `dia`. */
export function inicioDoPeriodo(dia: string, frequencia: Frequencia): string {
  const d = paraData(dia);
  if (frequencia === "semanal") {
    const semana = (d.getUTCDay() + 6) % 7; // segunda = 0
    d.setUTCDate(d.getUTCDate() - semana);
    return paraDia(d);
  }
  const mes = frequencia === "trimestral" ? Math.floor(d.getUTCMonth() / 3) * 3 : d.getUTCMonth();
  return paraDia(new Date(Date.UTC(d.getUTCFullYear(), mes, 1)));
}

/** Primeiro dia do período anterior. */
export function periodoAnterior(periodo: string, frequencia: Frequencia): string {
  const d = paraData(inicioDoPeriodo(periodo, frequencia));
  if (frequencia === "semanal") d.setUTCDate(d.getUTCDate() - 7);
  else d.setUTCMonth(d.getUTCMonth() - (frequencia === "trimestral" ? 3 : 1));
  return paraDia(d);
}

export function rotuloPeriodo(periodo: string, frequencia: Frequencia): string {
  const d = paraData(periodo);
  const ano = d.getUTCFullYear();
  if (frequencia === "semanal") {
    const [a, m, dd] = periodo.split("-");
    return `Semana de ${dd}/${m}/${a}`;
  }
  if (frequencia === "trimestral") return `${Math.floor(d.getUTCMonth() / 3) + 1}º tri ${ano}`;
  return `${MESES[d.getUTCMonth()]}/${ano}`;
}

/** Rótulo curto para o eixo do gráfico. */
export function rotuloCurto(periodo: string, frequencia: Frequencia): string {
  const d = paraData(periodo);
  if (frequencia === "semanal") return `${periodo.slice(8, 10)}/${periodo.slice(5, 7)}`;
  if (frequencia === "trimestral") return `T${Math.floor(d.getUTCMonth() / 3) + 1}/${String(d.getUTCFullYear()).slice(2)}`;
  return `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

/** Bateu a meta? Sem meta, não há farol. */
export function bateuMeta(valor: number, meta: number | null, sentido: Sentido): boolean | null {
  if (meta === null) return null;
  return sentido === "maior_melhor" ? valor >= meta : valor <= meta;
}

export function tomDaMedicao(valor: number, meta: number | null, sentido: Sentido): Tom {
  const b = bateuMeta(valor, meta, sentido);
  return b === null ? "neutro" : b ? "sucesso" : "perigo";
}

export type SituacaoIndicador = "na_meta" | "fora_da_meta" | "sem_meta" | "atrasado" | "sem_medicao";

export const VISUAL_SITUACAO_INDICADOR: Record<SituacaoIndicador, { rotulo: string; tom: Tom }> = {
  na_meta: { rotulo: "Na meta", tom: "sucesso" },
  fora_da_meta: { rotulo: "Fora da meta", tom: "perigo" },
  sem_meta: { rotulo: "Sem meta", tom: "neutro" },
  atrasado: { rotulo: "Lançamento atrasado", tom: "atencao" },
  sem_medicao: { rotulo: "Sem resultados", tom: "neutro" },
};

/**
 * Situação do indicador hoje. Espera-se o resultado do período que já fechou
 * (o anterior ao atual); se o último lançado é mais antigo, está atrasado.
 */
export function situacaoIndicador(
  ultima: { periodo: string; valor: number; meta: number | null } | null,
  indicador: { frequencia: Frequencia; sentido: Sentido },
  hoje: string,
): SituacaoIndicador {
  if (!ultima) return "sem_medicao";
  const esperado = periodoAnterior(inicioDoPeriodo(hoje, indicador.frequencia), indicador.frequencia);
  if (ultima.periodo < esperado) return "atrasado";
  const b = bateuMeta(ultima.valor, ultima.meta, indicador.sentido);
  return b === null ? "sem_meta" : b ? "na_meta" : "fora_da_meta";
}

/** "12,5%", "R$ 1.200,00", "42 leads". */
export function formatarValor(valor: number, unidade: string): string {
  const numero = valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const u = unidade.trim();
  if (!u) return numero;
  if (u === "R$") return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (u === "%") return `${numero}%`;
  return `${numero} ${u}`;
}

/** Aceita "1.234,5", "1234.5", "12%" e "R$ 10". */
export function lerNumero(texto: string): number | null {
  let t = texto.replace(/[^\d,.-]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // "1.200" = mil e duzentos
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
