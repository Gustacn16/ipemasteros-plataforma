"use client";

import { SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/** Busca em todo o conteúdo. A tecla "/" leva o cursor até ela. */
export function BuscaProcessos() {
  const ref = useRef<HTMLInputElement>(null);
  const termo = useSearchParams().get("busca") ?? "";
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || alvo?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);
  return (
    <form action="/processos" role="search" className="relative w-full sm:w-72">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
      <input
        ref={ref}
        key={termo}
        type="search"
        name="busca"
        defaultValue={termo}
        placeholder="Buscar em tudo…"
        aria-label="Buscar nos processos"
        className="border-input bg-card focus-visible:ring-ring h-9 w-full rounded-md border pr-9 pl-9 text-sm outline-none focus-visible:ring-2"
      />
      <kbd className="text-muted-foreground bg-muted pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 text-[0.7rem] sm:block">/</kbd>
    </form>
  );
}
