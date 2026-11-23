import { calcularFunil, type FunilMes, type PremissasFunil } from "./funil";
import { mesFechado, mesesDoAno } from "./meses";
import { totalDoMes, type MetasPorProduto } from "./turmas";

/** Metas calculadas de um mês: por produto e o funil do total. É o que fica guardado quando o mês fecha. */
export type RetratoMes = { produtos: MetasPorProduto; funil: FunilMes };

export function retratarMes(metas: MetasPorProduto, p: PremissasFunil): RetratoMes {
  return { produtos: metas, funil: calcularFunil(totalDoMes(metas), p) };
}

/** Mês fechado com retrato → retrato (a meta não muda mais); senão, o cálculo do plano atual. */
export function escolherMetaDoMes(mes: string, hoje: string, retratos: Record<string, RetratoMes>, calculado: RetratoMes): RetratoMes {
  return mesFechado(mes, hoje) && retratos[mes] ? retratos[mes] : calculado;
}

/**
 * Mês cuja meta não muda mais: já fechou e fechou com o plano existindo. Meses que fecharam
 * antes de o plano ser criado continuam editáveis (para preencher um ano já começado).
 */
export const mesTravado = (mes: string, hoje: string, mesCriacao: string) => mesFechado(mes, hoje) && mes >= mesCriacao;

export function mesesParaCongelar(ano: number, hoje: string, jaCongelados: string[], mesCriacao = "0000-00"): string[] {
  return mesesDoAno(ano).filter((m) => mesTravado(m, hoje, mesCriacao) && !jaCongelados.includes(m));
}
