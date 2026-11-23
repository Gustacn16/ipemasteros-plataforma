import { fonteAutomatica } from "./fontes";
import { mesComecou } from "./meses";

/** Mensagem de erro do lançamento, ou null quando pode lançar. */
export function validarLancamento({ mes, hoje, fonte }: { mes: string; hoje: string; fonte: string }): string | null {
  if (fonteAutomatica(fonte)) return "Este número vem sozinho da plataforma.";
  if (!mesComecou(mes, hoje)) return "Não dá para lançar um mês que ainda não começou.";
  return null;
}
