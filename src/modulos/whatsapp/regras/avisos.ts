// Regras puras dos avisos nos grupos de WhatsApp. São Paulo é UTC-3 fixo.
import type { TimeNumeroWhatsapp } from "@/generated/prisma/client";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";

export const ESPERA_MIN_S = 8;
export const ESPERA_MAX_S = 20;
export const MAX_GRUPOS_POR_AVISO = 30;
export const MAX_ENVIOS_NUMERO_DIA = 60;
export const MAX_TEXTO_AVISO = 1500;
export const HORA_INICIO_ENVIO = 8;
export const HORA_FIM_ENVIO = 20;

const OFFSET_MS = 3 * 60 * 60 * 1000;

/** Minúsculas, sem acento e com espaços simples, para comparar nomes de grupo. */
export function normalizarNome(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Segunda e domingo da semana seguinte (a que vem depois da semana de `agora`), como datas @db.Date. */
export function semanaSeguinte(agora: Date): { inicio: Date; fim: Date } {
  const hoje = diaEmSaoPaulo(agora);
  const diaDaSemana = new Date(`${hoje}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
  const segunda = somarDias(hoje, -((diaDaSemana + 6) % 7) + 7);
  return { inicio: new Date(`${segunda}T00:00:00.000Z`), fim: new Date(`${somarDias(segunda, 6)}T00:00:00.000Z`) };
}

/** Véspera do evento às 9h de São Paulo. `dataInicio` é a data @db.Date (meia-noite UTC). */
export function horarioSugerido(dataInicio: Date): Date {
  const vespera = somarDias(dataInicio.toISOString().slice(0, 10), -1);
  return new Date(`${vespera}T09:00:00-03:00`);
}

function horaDecimalEmSaoPaulo(d: Date): number {
  const s = new Date(d.getTime() - OFFSET_MS);
  return s.getUTCHours() + s.getUTCMinutes() / 60 + s.getUTCSeconds() / 3600;
}

/** Devolve a mensagem de erro ou null se o aviso cabe na janela de envio. */
export function validarJanela(agendadoPara: Date, grupos: number): string | null {
  if (grupos < 1) return "Escolha ao menos um grupo.";
  if (grupos > MAX_GRUPOS_POR_AVISO) return `Um aviso vai a no máximo ${MAX_GRUPOS_POR_AVISO} grupos.`;
  if (horaDecimalEmSaoPaulo(agendadoPara) < HORA_INICIO_ENVIO) return `Os avisos saem a partir das ${HORA_INICIO_ENVIO}h.`;
  // O último envio sai depois de (grupos - 1) esperas, no pior caso a máxima.
  const ultimo = new Date(agendadoPara.getTime() + (grupos - 1) * ESPERA_MAX_S * 1000);
  const h = horaDecimalEmSaoPaulo(ultimo);
  const mesmoDia = diaEmSaoPaulo(ultimo) === diaEmSaoPaulo(agendadoPara);
  if (!mesmoDia || h > HORA_FIM_ENVIO) return `O último envio passaria das ${HORA_FIM_ENVIO}h. Marque um horário mais cedo ou escolha menos grupos.`;
  return null;
}

/** Segundos acumulados de cada envio: o primeiro é 0 e cada intervalo fica entre 8 e 20 s. */
export function atrasosEnvio(n: number, aleatorio: () => number = Math.random): number[] {
  const out: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) total += ESPERA_MIN_S + Math.floor(aleatorio() * (ESPERA_MAX_S - ESPERA_MIN_S + 1));
    out.push(total);
  }
  return out;
}

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Texto inicial do aviso de um evento. */
export function textoPadrao(e: { titulo: string; dataInicio: Date; horaInicio: string | null; local: string | null; descricao: string | null }): string {
  const iso = e.dataInicio.toISOString().slice(0, 10);
  const data = `${DIAS[e.dataInicio.getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const linhas = [`*${e.titulo}*`, `Data: ${data}${e.horaInicio ? ` às ${e.horaInicio}` : ""}`];
  if (e.local) linhas.push(`Local: ${e.local}`);
  if (e.descricao) linhas.push(e.descricao);
  return linhas.join("\n");
}

/** Prefere o número do time cs; senão o primeiro por nome. */
export function escolherNumero(numeros: { id: string; nome: string; time: TimeNumeroWhatsapp }[]): string | null {
  if (numeros.length === 0) return null;
  const porNome = [...numeros].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (porNome.find((n) => n.time === "cs") ?? porNome[0]).id;
}
