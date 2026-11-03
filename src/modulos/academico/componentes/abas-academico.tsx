"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/academico", rotulo: "Visão geral" },
  { href: "/academico/turmas", rotulo: "Turmas" },
  { href: "/academico/alunos", rotulo: "Alunos" },
  { href: "/academico/professores", rotulo: "Professores" },
];

export function AbasAcademico() {
  const caminho = usePathname();
  return (
    <nav aria-label="Acadêmico" className="flex gap-1 overflow-x-auto border-b">
      {ABAS.map((a) => {
        const ativa = a.href === "/academico" ? caminho === a.href : caminho === a.href || caminho.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              ativa ? "border-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
