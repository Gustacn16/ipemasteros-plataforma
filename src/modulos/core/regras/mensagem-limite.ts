// Mensagem do limite de tentativas. Sem dependências de servidor: a tela de
// login (no navegador) também usa.

/** Cabeçalho com os segundos que faltam para liberar (o mesmo que o Better Auth usa). */
export const CABECALHO_ESPERA = "X-Retry-After";

export function mensagemMuitasTentativas(segundos: number | null): string {
  if (segundos === null) return "Muitas tentativas. Tente de novo em alguns minutos.";
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

export function segundosDoCabecalho(valor: string | null | undefined): number | null {
  if (!valor || !/^\d+$/.test(valor.trim())) return null;
  return Number(valor.trim());
}
