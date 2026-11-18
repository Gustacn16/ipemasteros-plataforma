const formato = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Micro-dólares em "US$ 12,34". */
export function formatarMicroUsd(microUsd: number): string {
  return `US$ ${formato.format(microUsd / 1_000_000)}`;
}
