"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AbasProcessos({ editor }: { editor: boolean }) {
  const caminho = usePathname();
  const abas = [
    { href: "/processos", rotulo: "Documentos", ativa: caminho === "/processos" || caminho.startsWith("/processos/documentos") },
    { href: "/processos/indicadores", rotulo: "Indicadores", ativa: caminho.startsWith("/processos/indicadores") },
    ...(editor ? [{ href: "/processos/organizar", rotulo: "Organizar", ativa: caminho.startsWith("/processos/organizar") }] : []),
  ];
  return (
    <nav aria-label="Processos" className="flex gap-1 overflow-x-auto border-b">
      {abas.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          aria-current={a.ativa ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
            a.ativa ? "border-primary text-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
