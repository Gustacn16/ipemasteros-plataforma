import { toast } from "sonner";

type Resultado = { ok: boolean; mensagem?: string };

/** Mostra o resultado de uma Server Action num toast. Retorna se deu certo. */
export function avisar(resultado: Resultado, sucessoPadrao?: string): boolean {
  if (resultado.ok) {
    if (resultado.mensagem ?? sucessoPadrao) toast.success(resultado.mensagem ?? sucessoPadrao);
  } else {
    toast.error(resultado.mensagem ?? "Não foi possível concluir.");
  }
  return resultado.ok;
}
