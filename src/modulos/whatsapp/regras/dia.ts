// Janela de "ontem" no calendário de São Paulo (UTC-3 fixo).
import { inicioDoDiaSaoPaulo } from "@/lib/ia/limites";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";

const MS_DIA = 86_400_000;

/** `dia` é a meia-noite UTC da data de São Paulo de ontem (para gravar em @db.Date). */
export function janelaDeOntem(agora: Date): { dia: Date; inicio: Date; fim: Date } {
  const fim = inicioDoDiaSaoPaulo(agora);
  const inicio = new Date(fim.getTime() - MS_DIA);
  const dia = new Date(`${diaEmSaoPaulo(inicio)}T00:00:00.000Z`);
  return { dia, inicio, fim };
}

/** Lê `?dia=AAAA-MM-DD`; vazio ou inválido (formato ou data que não existe) vira ontem. Devolve a data de São Paulo e a meia-noite UTC dela. */
export function diaDaConsulta(valor: string | undefined, agora: Date): { texto: string; dia: Date } {
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const dia = new Date(`${valor}T00:00:00.000Z`);
    if (!Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === valor) return { texto: valor, dia };
  }
  const { dia } = janelaDeOntem(agora);
  return { texto: dia.toISOString().slice(0, 10), dia };
}

/** Semana de segunda a domingo no calendário de São Paulo. `inicio`/`fim` são instantes (fim exclusivo); `texto` é a segunda "AAAA-MM-DD". */
export type Semana = { inicio: Date; fim: Date; texto: string; rotulo: string };

function semanaDaSegunda(segunda: string): Semana {
  const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return {
    inicio: new Date(`${segunda}T03:00:00.000Z`),
    fim: new Date(`${somarDias(segunda, 7)}T03:00:00.000Z`),
    texto: segunda,
    rotulo: `${ddmm(segunda)} a ${ddmm(somarDias(segunda, 6))}`,
  };
}

/** Segunda-feira ("AAAA-MM-DD") da semana de São Paulo de `agora`. */
function segundaDaSemana(agora: Date): string {
  const hoje = diaEmSaoPaulo(agora);
  const diaDaSemana = new Date(`${hoje}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
  return somarDias(hoje, -((diaDaSemana + 6) % 7));
}

/** Lê `?semana=AAAA-MM-DD` (uma segunda-feira); vazio, inválido, fora de segunda ou futuro vira a semana atual. */
export function semanaDaConsulta(valor: string | undefined, agora: Date): Semana {
  const atual = segundaDaSemana(agora);
  if (valor && valor > atual) return semanaDaSegunda(atual);
  if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const dia = new Date(`${valor}T00:00:00.000Z`);
    if (!Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === valor && dia.getUTCDay() === 1) return semanaDaSegunda(valor);
  }
  return semanaDaSegunda(atual);
}

/** As `n` últimas semanas, da mais antiga para a atual. */
export function ultimasSemanas(agora: Date, n: number): Semana[] {
  const atual = segundaDaSemana(agora);
  return Array.from({ length: n }, (_, i) => semanaDaSegunda(somarDias(atual, (i - (n - 1)) * 7)));
}
