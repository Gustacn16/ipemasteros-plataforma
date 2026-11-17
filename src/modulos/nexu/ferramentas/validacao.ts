import { ErroNegocio } from "@/lib/erros";

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Confere "AAAA-MM-DD" (e que o dia existe). */
export function validarDia(dia: string): string {
  const data = new Date(`${dia}T00:00:00Z`);
  if (!FORMATO_DIA.test(dia) || Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== dia) {
    throw new ErroNegocio("Data inválida. Use AAAA-MM-DD.");
  }
  return dia;
}

/** Confere "AAAA-MM". */
export function validarMes(mes: string): string {
  if (!FORMATO_MES.test(mes)) throw new ErroNegocio("Mês inválido. Use AAAA-MM.");
  return mes;
}
