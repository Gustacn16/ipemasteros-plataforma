import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Icone className="size-6" aria-hidden />
      </span>
      <h2 className="text-foreground text-base font-semibold">{titulo}</h2>
      {descricao ? <p className="text-muted-foreground max-w-sm text-sm">{descricao}</p> : null}
      {acao ? <div className="mt-1">{acao}</div> : null}
    </div>
  );
}
