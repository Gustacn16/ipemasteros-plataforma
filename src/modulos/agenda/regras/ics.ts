import { somarDias } from "@/modulos/tarefas/regras/prazo";

/** Evento institucional já convertido para o feed (dias em "AAAA-MM-DD", horas em "HH:MM"). */
export type EventoIcs = {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  turma: string | null;
  dataInicio: string;
  dataFim: string;
  horaInicio: string | null;
  horaFim: string | null;
  atualizadoEm: Date;
};

const FUSO = "America/Sao_Paulo";
const LIMITE_OCTETOS = 75;

/** Escapa o valor de um campo de texto (RFC 5545, 3.3.11). */
export function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Dobra a linha em 75 octetos UTF-8, sem partir caractere; a continuação começa com um espaço. */
function dobrar(linha: string): string {
  if (Buffer.byteLength(linha, "utf8") <= LIMITE_OCTETOS) return linha;
  const partes: string[] = [];
  let atual = "";
  let octetos = 0;
  let limite = LIMITE_OCTETOS;
  for (const c of linha) {
    const n = Buffer.byteLength(c, "utf8");
    if (octetos + n > limite) {
      partes.push(atual);
      atual = "";
      octetos = 0;
      limite = LIMITE_OCTETOS - 1; // o espaço inicial conta
    }
    atual += c;
    octetos += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const soDigitos = (v: string) => v.replace(/\D/g, "");
const dataHoraLocal = (dia: string, hora: string) => `${soDigitos(dia)}T${soDigitos(hora)}00`;

function instanteUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function linhasDoEvento(e: EventoIcs, agora: Date): string[] {
  const titulo = e.turma ? `${e.titulo} (${e.turma})` : e.titulo;
  const l = [
    "BEGIN:VEVENT",
    `UID:${e.id}@ipemaster`,
    `DTSTAMP:${instanteUtc(agora)}`,
    `LAST-MODIFIED:${instanteUtc(e.atualizadoEm)}`,
    `SUMMARY:${escaparTexto(titulo)}`,
  ];
  if (e.horaInicio) {
    l.push(`DTSTART;TZID=${FUSO}:${dataHoraLocal(e.dataInicio, e.horaInicio)}`);
    l.push(`DTEND;TZID=${FUSO}:${dataHoraLocal(e.dataFim, e.horaFim ?? e.horaInicio)}`);
  } else {
    l.push(`DTSTART;VALUE=DATE:${soDigitos(e.dataInicio)}`);
    l.push(`DTEND;VALUE=DATE:${soDigitos(somarDias(e.dataFim, 1))}`);
  }
  if (e.local) l.push(`LOCATION:${escaparTexto(e.local)}`);
  if (e.descricao) l.push(`DESCRIPTION:${escaparTexto(e.descricao)}`);
  l.push("END:VEVENT");
  return l;
}

/** Gera o arquivo .ics (VCALENDAR) do calendário institucional. Linhas terminam em CRLF. */
export function gerarIcs(eventos: EventoIcs[], agora: Date): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IPEMaster//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:IPEMaster",
    `X-WR-TIMEZONE:${FUSO}`,
    "BEGIN:VTIMEZONE",
    `TZID:${FUSO}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...eventos.flatMap((e) => linhasDoEvento(e, agora)),
    "END:VCALENDAR",
  ];
  return linhas.map((l) => `${dobrar(l)}\r\n`).join("");
}
