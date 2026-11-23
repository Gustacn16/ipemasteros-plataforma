"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ItemSumario } from "../regras/sumario";

/** "Nesta página": índice fixo à direita (telas largas), marcando a seção em leitura. */
export function Sumario({ itens }: { itens: ItemSumario[] }) {
  const [ativo, setAtivo] = useState<string | null>(null);

  useEffect(() => {
    const alvos = itens.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => e !== null);
    if (alvos.length === 0) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtivo(visivel.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    alvos.forEach((a) => observador.observe(a));
    return () => observador.disconnect();
  }, [itens]);

  if (itens.length < 2) return <div className="hidden xl:block" />;
  return (
    <nav aria-label="Nesta página" className="hidden xl:sticky xl:top-6 xl:block xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">Nesta página</p>
      <ul className="grid gap-0.5 border-l text-sm">
        {itens.map((i, k) => (
          <li key={`${i.id}-${k}`}>
            <a
              href={`#${i.id}`}
              className={cn(
                "-ml-px block border-l-2 py-1 leading-snug",
                i.nivel === 3 ? "pl-6 text-[0.8rem]" : "pl-3",
                ativo === i.id ? "border-primary text-primary font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {i.texto}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
