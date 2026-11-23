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
