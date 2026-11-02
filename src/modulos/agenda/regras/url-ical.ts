/**
 * Validação dos links iCal da agenda pessoal. Só aceita os endereços secretos
 * do Google Agenda e do Outlook, para impedir SSRF (o servidor busca a URL).
 */

const MENSAGEM = "Use o endereço secreto iCal do Google Agenda ou do Outlook.";

/** Host permitido → prefixo obrigatório do caminho. */
const PERMITIDOS: Record<string, string> = {
  "calendar.google.com": "/calendar/ical/",
  "outlook.office365.com": "/owa/calendar/",
  "outlook.live.com": "/owa/calendar/",
};

export type ResultadoUrlIcal = { ok: true; url: URL } | { ok: false; mensagem: string };

export function validarUrlIcal(texto: string): ResultadoUrlIcal {
  const recusa = { ok: false as const, mensagem: MENSAGEM };
  const limpo = texto.trim().replace(/^webcal:\/\//i, "https://");

  // Autoridade como foi digitada: recusa porta (mesmo :443) e usuário/senha.
  const autoridade = /^https:\/\/([^/?#]*)/i.exec(limpo)?.[1];
  if (autoridade === undefined || autoridade.includes(":") || autoridade.includes("@")) return recusa;

  let url: URL;
  try {
    url = new URL(limpo);
  } catch {
    return recusa;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return recusa;

  const prefixo = Object.hasOwn(PERMITIDOS, url.hostname) ? PERMITIDOS[url.hostname] : undefined;
  if (!prefixo || !url.pathname.startsWith(prefixo)) return recusa;

  return { ok: true, url };
}

/** Mostra só o host e os últimos 6 caracteres: "calendar.google.com …a1b2c3". */
export function mascararUrl(url: string): string {
  const fim = url.slice(-6);
  try {
    return `${new URL(url).hostname} …${fim}`;
  } catch {
    return `…${fim}`;
  }
}
