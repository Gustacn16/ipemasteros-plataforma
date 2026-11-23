// Meses como texto "AAAA-MM".

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function mesesDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

export const mesDoDia = (dia: string) => dia.slice(0, 7);

/** O mês já terminou (é anterior ao mês de hoje). `hoje` = "AAAA-MM-DD". */
export const mesFechado = (mes: string, hoje: string) => mes < mesDoDia(hoje);

/** O mês já começou (é o atual ou anterior). */
export const mesComecou = (mes: string, hoje: string) => mes <= mesDoDia(hoje);

/** Coluna @db.Date do dia 1 do mês. */
export const dataDoMes = (mes: string) => new Date(`${mes}-01T00:00:00.000Z`);
export const mesDaData = (d: Date) => d.toISOString().slice(0, 7);

/** Ano que a tela abre: o atual se tiver plano; senão o próximo plano; senão o último. */
export function anoPadrao(anos: number[], hoje: string): number {
  const atual = Number(hoje.slice(0, 4));
  if (anos.includes(atual)) return atual;
  if (anos.length === 0) return Number(hoje.slice(5, 7)) >= 10 ? atual + 1 : atual; // no fim do ano, planeja-se o seguinte
  return anos.find((a) => a > atual) ?? anos.at(-1) ?? atual;
}

/**
 * Meses que entram no acumulado: do 1º até o escolhido, sem o mês em andamento (a meta dele
 * ainda não pode ser cobrada inteira). Se só sobra o mês em andamento, usa ele.
 */
export function mesesDoAcumulado(meses: string[], escolhido: string, hoje: string): string[] {
  const ate = meses.filter((m) => m <= escolhido && mesComecou(m, hoje));
  const fechados = ate.filter((m) => mesFechado(m, hoje));
  return fechados.length ? fechados : ate;
}
