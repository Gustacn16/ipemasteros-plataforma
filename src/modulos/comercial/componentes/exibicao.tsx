import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { ROTULO_TIPO_PRODUTO, type TipoProduto } from "../esquemas/produto";

export const estiloCampo = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";
export const estiloSelect = "border-input bg-background h-9 rounded-md border px-2 text-sm";

const COR_TIPO: Record<TipoProduto, string> = {
  curso_livre: "bg-sky-100 text-sky-800",
  paciente_modelo: "bg-amber-100 text-amber-800",
  pos_graduacao: "bg-violet-100 text-violet-800",
};

export function SeloTipo({ tipo }: { tipo: TipoProduto }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", COR_TIPO[tipo])}>{ROTULO_TIPO_PRODUTO[tipo]}</span>
  );
}

export function SeloInativo() {
  return <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-600">Inativo</span>;
}

/** "10x de R$ 600,00", "À vista" ou "10x" quando o valor da parcela não foi informado. */
export function descreverParcelas(parcelas: number, valorParcela: string): string {
  if (parcelas === 0) return "À vista";
  return Number(valorParcela) > 0 ? `${parcelas}x de ${formatarReais(valorParcela)}` : `${parcelas}x`;
}

/** Comissão: "R$ 150,00" ou "2%". */
export function descreverComissao(tipo: "valor" | "percentual", valor: string): string {
  return tipo === "percentual" ? `${Number(valor).toLocaleString("pt-BR")}%` : formatarReais(valor);
}
