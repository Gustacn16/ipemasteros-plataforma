"use client";

import { KanbanSquareIcon, ListIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { gravarCookie } from "@/lib/cookie-navegador";
import { cn } from "@/lib/utils";
import { COOKIE_VISAO, type Visao } from "../regras/visao";

const OPCOES = [
  { valor: "lista", rotulo: "Lista", icone: ListIcon },
  { valor: "quadro", rotulo: "Quadro", icone: KanbanSquareIcon },
] as const;

/** Alterna Lista/Quadro. A escolha fica salva neste navegador para todas as listas. */
export function AlternarVisao({ visao }: { visao: Visao }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function escolher(nova: Visao) {
    gravarCookie(COOKIE_VISAO, nova, "/tarefas");
    iniciar(() => router.refresh());
  }

  return (
    <div role="group" aria-label="Visualização" className={cn("bg-muted inline-flex rounded-lg p-0.5", pendente && "opacity-60")}>
      {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
        <button
          key={valor}
          type="button"
          aria-pressed={visao === valor}
          onClick={() => escolher(valor)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
            visao === valor ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icone className="size-4" aria-hidden />
          {rotulo}
        </button>
      ))}
    </div>
  );
}
