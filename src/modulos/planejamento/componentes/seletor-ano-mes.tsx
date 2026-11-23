"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { mesesDoAno } from "../regras/meses";
import { rotuloMesCurto } from "./formatar";

const botao = "hover:bg-muted rounded-md border p-1.5 disabled:opacity-40";

/** Ano com ◀ ▶ e, quando `mes` vem, os 12 meses para escolher. Tudo na URL. */
export function SeletorAnoMes({ ano, mes }: { ano: number; mes?: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const ir = (a: number, m?: string) => router.push(`${caminho}?ano=${a}${m ? `&mes=${m}` : ""}`);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <button type="button" className={botao} aria-label="Ano anterior" onClick={() => ir(ano - 1)}>
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="min-w-14 text-center text-lg font-semibold tabular-nums">{ano}</span>
        <button type="button" className={botao} aria-label="Próximo ano" onClick={() => ir(ano + 1)}>
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      {mes && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Mês">
          {mesesDoAno(ano).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === mes}
              onClick={() => ir(ano, m)}
              className={
                m === mes
                  ? "bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs font-medium capitalize"
                  : "hover:bg-muted rounded-md border px-2 py-1 text-xs capitalize"
              }
            >
              {rotuloMesCurto(m)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
