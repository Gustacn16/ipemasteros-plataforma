// Valores em reais. No banco ficam como Decimal(12,2); entre servidor e tela,
// como string decimal ("3300.00"), porque Decimal não atravessa para o cliente.

// "3.300,00", "1.000" (ponto = milhar, vírgula = decimal).
// Vírgula sem centavos ("1.234,") vale como inteiro: é o que a máscara deixa no meio da digitação.
const FORMATO_BRASILEIRO = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{0,2}))?$/;
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

/**
 * Máscara de reais para digitar: "1234,5" → "R$ 1.234,5". Pontos digitados são ignorados
 * (o milhar é posto sozinho); a primeira vírgula separa até dois centavos.
 */
export function mascararReais(texto: string): string {
  const limpo = texto.replace(/[^\d,]/g, "");
  if (!/\d/.test(limpo)) return "";
  const virgula = limpo.indexOf(",");
  const inteiroBruto = virgula === -1 ? limpo : limpo.slice(0, virgula);
  const inteiro = (inteiroBruto.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centavos = virgula === -1 ? null : limpo.slice(virgula + 1).replace(/,/g, "").slice(0, 2);
  return `R$ ${inteiro}${centavos === null ? "" : `,${centavos}`}`;
}
