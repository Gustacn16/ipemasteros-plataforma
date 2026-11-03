"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Abas do módulo Comercial. */
export function AbasComercial({ podeGerenciar }: { podeGerenciar: boolean }) {
  const caminho = usePathname();
  const abas = [
    { href: "/comercial", rotulo: "Dashboard" },
    { href: "/comercial/vendas", rotulo: "Vendas" },
    { href: "/comercial/metas", rotulo: "Metas" },
    { href: "/comercial/produtos", rotulo: "Produtos" },
    ...(podeGerenciar ? [{ href: "/comercial/canais", rotulo: "Canais" }] : []),
  ];
  return (
    <nav aria-label="Comercial" className="flex gap-1 border-b">
      {abas.map((a) => {
        // O Dashboard ("/comercial") só fica ativo na própria página, não nas abas abaixo dele.
        const ativa = a.href === "/comercial" ? caminho === a.href : caminho === a.href || caminho.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
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
