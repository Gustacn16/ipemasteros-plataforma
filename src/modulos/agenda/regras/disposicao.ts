// Regras puras de disposição das visões da Agenda (intervalo, título, ordem e
// posição dos itens com hora). Dias "AAAA-MM-DD"; horas "HH:MM" em São Paulo.
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { diasDaSemana, gradeDoMes, type VisaoAgenda } from "./periodo";

export const DIAS_LISTA = 60;
/** A grade da semana vai das 06:00 às 23:00. */
export const INICIO_GRADE = 6 * 60;
export const FIM_GRADE = 23 * 60;
const DURACAO_MINIMA = 30;

type ComPeriodo = { inicio: string; fim: string };
type ComHora = { horaInicio: string | null; horaFim: string | null };

/** Primeiro e último dia que a visão mostra. */
export function intervaloDaVisao(visao: VisaoAgenda, data: string): { de: string; ate: string } {
  if (visao === "mes") {
    const grade = gradeDoMes(data.slice(0, 7));
    return { de: grade[0][0].dia, ate: grade[grade.length - 1][6].dia };
  }
  if (visao === "semana") {
    const dias = diasDaSemana(data);
    return { de: dias[0], ate: dias[6] };
  }
  return { de: data, ate: somarDias(data, DIAS_LISTA - 1) };
}

const emData = (dia: string) => new Date(`${dia}T00:00:00Z`);
const fmt = (opcoes: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opcoes });
const formatoMes = fmt({ month: "long", year: "numeric" });
const formatoDiaMes = fmt({ day: "numeric", month: "short" });
const formatoDiaMesAno = fmt({ day: "numeric", month: "short", year: "numeric" });

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function faixaDeDias(de: string, ate: string): string {
  if (de.slice(0, 4) !== ate.slice(0, 4)) {
    return `${formatoDiaMesAno.format(emData(de))} a ${formatoDiaMesAno.format(emData(ate))}`;
  }
  if (de.slice(0, 7) === ate.slice(0, 7)) {
    return `${Number(de.slice(8))} a ${formatoDiaMesAno.format(emData(ate))}`;
  }
  return `${formatoDiaMes.format(emData(de))} a ${formatoDiaMesAno.format(emData(ate))}`;
}

/** Título do período mostrado: "Novembro de 2026", "1 a 7 de nov. de 2026"… */
export function tituloDoPeriodo(visao: VisaoAgenda, data: string): string {
  if (visao === "mes") return maiuscula(formatoMes.format(emData(`${data.slice(0, 7)}-01`)));
  const { de, ate } = intervaloDaVisao(visao, data);
  return faixaDeDias(de, ate);
}

export function cobreDia(item: ComPeriodo, dia: string): boolean {
  return item.inicio <= dia && item.fim >= dia;
}

/** Dia inteiro primeiro, depois por hora de início e título. */
export function compararItens<T extends ComHora & { titulo: string }>(a: T, b: T): number {
  if ((a.horaInicio === null) !== (b.horaInicio === null)) return a.horaInicio === null ? -1 : 1;
  return (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "") || a.titulo.localeCompare(b.titulo, "pt-BR");
}

/** Dias do intervalo com os itens que os cobrem, omitindo os vazios. */
export function agruparPorDia<T extends ComPeriodo & ComHora & { titulo: string }>(
  itens: T[],
  de: string,
  quantidade: number,
): { dia: string; itens: T[] }[] {
  const grupos: { dia: string; itens: T[] }[] = [];
  for (let i = 0; i < quantidade; i++) {
    const dia = somarDias(de, i);
    const doDia = itens.filter((item) => cobreDia(item, dia)).sort(compararItens);
    if (doDia.length > 0) grupos.push({ dia, itens: doDia });
  }
  return grupos;
}

export function minutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

/** Topo e altura (frações de 0 a 1) do item na grade das 06:00 às 23:00. Antes das 6 encosta no topo. */
export function posicaoNaGrade(horaInicio: string, horaFim: string | null): { topo: number; altura: number } {
  const total = FIM_GRADE - INICIO_GRADE;
  const inicio = Math.min(Math.max(minutos(horaInicio), INICIO_GRADE), FIM_GRADE - DURACAO_MINIMA);
  const fimBruto = horaFim === null ? inicio + 60 : minutos(horaFim);
  const fim = Math.min(Math.max(fimBruto, inicio + DURACAO_MINIMA), FIM_GRADE);
  return { topo: (inicio - INICIO_GRADE) / total, altura: (fim - inicio) / total };
}

/** Distribui em raias lado a lado os itens com hora de um dia que se sobrepõem. */
export function raiasDoDia<T extends ComHora & { id: string; titulo: string }>(
  itens: T[],
): { item: T; topo: number; altura: number; raia: number; raias: number }[] {
  const posicionados = [...itens]
    .filter((i): i is T & { horaInicio: string } => i.horaInicio !== null)
    .sort(compararItens)
    .map((item) => ({ item, ...posicaoNaGrade(item.horaInicio, item.horaFim), raia: 0, raias: 1 }));

  let grupo: typeof posicionados = [];
  let fimDoGrupo = -1;
  const fecharGrupo = () => {
    const raias = Math.max(0, ...grupo.map((g) => g.raia)) + 1;
    for (const g of grupo) g.raias = raias;
  };

  for (const p of posicionados) {
    if (p.topo >= fimDoGrupo) {
      fecharGrupo();
      grupo = [];
      fimDoGrupo = -1;
    }
    const ocupadas = new Set(grupo.filter((g) => g.topo + g.altura > p.topo).map((g) => g.raia));
    let raia = 0;
    while (ocupadas.has(raia)) raia++;
    p.raia = raia;
    grupo.push(p);
    fimDoGrupo = Math.max(fimDoGrupo, p.topo + p.altura);
  }
  fecharGrupo();
  return posicionados;
}
