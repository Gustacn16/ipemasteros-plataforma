import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  compacto = false,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  /** Versão menor, para blocos lado a lado. */
  compacto?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed text-center",
        compacto ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
      )}
    >
      <span
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center rounded-full",
          compacto ? "size-9" : "size-12",
        )}
      >
        <Icone className={compacto ? "size-4" : "size-6"} aria-hidden />
      </span>
      {compacto ? (
        <p className="text-foreground text-sm font-medium">{titulo}</p>
      ) : (
        <h2 className="text-foreground text-base font-semibold">{titulo}</h2>
      )}
      {descricao ? <p className="text-muted-foreground max-w-sm text-sm">{descricao}</p> : null}
      {acao ? <div className="mt-1">{acao}</div> : null}
    </div>
  );
}
