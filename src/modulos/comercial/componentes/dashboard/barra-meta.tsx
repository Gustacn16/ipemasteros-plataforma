import { cn } from "@/lib/utils";
import { faixaMeta } from "../../regras/dashboard";
import { COR_FAIXA } from "./estilos";

/** Barra de progresso contra a meta, com a cor da faixa; "—" quando não há meta. */
export function BarraMeta({ percentual }: { percentual: number | null }) {
  const faixa = faixaMeta(percentual);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        {faixa && <div className={cn("h-full rounded-full", COR_FAIXA[faixa].barra)} style={{ width: `${Math.min(percentual!, 100)}%` }} />}
      </div>
      <span className={cn("w-11 text-right text-xs font-medium", faixa ? COR_FAIXA[faixa].texto : "text-white/50")}>
        {percentual === null ? "—" : `${percentual}%`}
      </span>
    </div>
  );
}
