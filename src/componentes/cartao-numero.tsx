import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { CLASSE_TEXTO_TOM, textoVariacao, type Tom } from "./regras-visuais";

export function CartaoNumero({
  rotulo,
  icone: Icone,
  valor,
  variacao,
  unidadeVariacao = "%",
  tom = "neutro",
  children,
}: {
  rotulo: string;
  icone?: LucideIcon;
  valor: ReactNode;
  variacao?: number | null;
  unidadeVariacao?: "%" | "pp";
  tom?: Tom;
  children?: ReactNode;
}) {
  const v = textoVariacao(variacao ?? null, unidadeVariacao);
  return (
    <div className="bg-card text-card-foreground flex min-w-0 flex-col gap-2 rounded-xl border p-4">
      <div
        className={cn(
          "flex items-center gap-2 text-sm",
          tom === "neutro" ? "text-muted-foreground" : CLASSE_TEXTO_TOM[tom],
        )}
      >
        {Icone ? <Icone className="size-4 shrink-0" aria-hidden /> : null}
        <span className="truncate">{rotulo}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-foreground text-3xl font-semibold tabular-nums">{valor}</span>
        {v ? (
          <span className={cn("text-sm font-medium tabular-nums", CLASSE_TEXTO_TOM[v.tom])}>{v.texto}</span>
        ) : null}
      </div>
      {children ? <div className="text-muted-foreground text-xs">{children}</div> : null}
    </div>
  );
}
