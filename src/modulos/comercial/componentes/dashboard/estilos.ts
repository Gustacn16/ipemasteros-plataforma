// Peças visuais do dashboard escuro (referência do usuário: cartões translúcidos e pílulas).
import type { FaixaMeta } from "../../regras/dashboard";

export const cartao = "rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm";
export const pilula = "h-10 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white";
export const tituloCartao = "text-base font-medium text-white";
export const textoApagado = "text-white/60";

export const COR_FAIXA: Record<FaixaMeta, { texto: string; barra: string }> = {
  verde: { texto: "text-emerald-300", barra: "bg-emerald-400" },
  amarelo: { texto: "text-amber-300", barra: "bg-amber-300" },
  vermelho: { texto: "text-rose-300", barra: "bg-rose-400" },
};

const formatoCompacto = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "494070.00" → "R$ 494,1 mil". */
export const reaisCompacto = (v: string | number) => formatoCompacto.format(Number(v)).replace(/ /g, " ");

const formatoMesCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" });

/** "2026-11" → "nov". */
export const mesCurto = (mes: string) => formatoMesCurto.format(new Date(`${mes}-01T00:00:00Z`)).replace(".", "");
