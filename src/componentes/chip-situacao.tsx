import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { CLASSE_TEXTO_TOM, type Tom } from "./regras-visuais";

const CLASSE_TOM: Record<Tom, string> = {
  sucesso: "bg-sucesso-suave border-sucesso/30",
  atencao: "bg-atencao-suave border-atencao/30",
  perigo: "bg-perigo-suave border-perigo/30",
  informacao: "bg-informacao-suave border-informacao/30",
  neutro: "bg-muted border-border",
};

/** Pílula com ícone e texto. `cor` livre (status vindo do banco) vence o `tom`. */
export function ChipSituacao({
  tom = "neutro",
  cor,
  icone: Icone,
  children,
  tamanho = "md",
}: {
  tom?: Tom;
  cor?: string;
  icone?: LucideIcon;
  children: ReactNode;
  tamanho?: "sm" | "md";
}) {
  const estilo = cor
    ? { backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)`, borderColor: cor }
    : undefined;
  return (
    <span
      style={estilo}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        tamanho === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        cor ? "text-foreground" : ["text-foreground", CLASSE_TOM[tom]],
      )}
    >
      {Icone ? (
        <Icone
          className={cn("shrink-0", tamanho === "sm" ? "size-3" : "size-3.5", !cor && CLASSE_TEXTO_TOM[tom])}
          style={cor ? { color: cor } : undefined}
          aria-hidden
        />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
