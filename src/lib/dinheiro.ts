// Valores em reais. No banco ficam como Decimal(12,2); entre servidor e tela,
// como string decimal ("3300.00"), porque Decimal não atravessa para o cliente.

// "3.300,00", "1.000" (ponto = milhar, vírgula = decimal).
const FORMATO_BRASILEIRO = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
// "1234.56" (ponto decimal, sem separador de milhar).
const FORMATO_PONTO = /^(\d+)\.(\d{1,2})$/;

/** Lê um valor digitado ("R$ 3.300,00", "1234.56") como "3300.00"; `null` se inválido. */
export function lerReais(texto: string): string | null {
  const limpo = texto.replace(/R\$/g, "").replace(/\s/g, "");
  const m = FORMATO_PONTO.exec(limpo) ?? FORMATO_BRASILEIRO.exec(limpo);
  if (!m) return null;
  const inteiro = m[1]!.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const centavos = (m[2] ?? "").padEnd(2, "0");
  return `${inteiro}.${centavos}`;
}

const formato = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "3300.00" → "R$ 3.300,00". */
export function formatarReais(valor: string | number): string {
  return formato.format(Number(valor)).replace(/ /g, " ");
}
