"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { itensConfiguracao } from "./subabas-configuracoes";

/** Abas do módulo Comercial. */
export function AbasComercial({
  podeGerenciar,
  podeIntegrarMeta,
  podeAvisoVenda,
}: {
  podeGerenciar: boolean;
  podeIntegrarMeta: boolean;
  podeAvisoVenda: boolean;
}) {
  const caminho = usePathname();
  // Canais, Meta Ads e Aviso de venda ficam juntos numa aba só, que abre no primeiro permitido.
  const configuracoes = itensConfiguracao({ canais: podeGerenciar, meta: podeIntegrarMeta, avisoVenda: podeAvisoVenda });
  const abas = [
    { href: "/comercial", rotulo: "Dashboard" },
    { href: "/comercial/vendas", rotulo: "Vendas" },
    { href: "/comercial/metas", rotulo: "Metas" },
    { href: "/comercial/comissoes", rotulo: "Comissões" },
    { href: "/comercial/produtos", rotulo: "Produtos" },
    ...(configuracoes.length > 0
      ? [{ href: configuracoes[0]!.href, rotulo: "Configurações", grupo: configuracoes.map((c) => c.href) }]
      : []),
  ];
  return (
    <nav aria-label="Comercial" className="flex gap-1 border-b">
      {abas.map((a) => {
        // O Dashboard ("/comercial") só fica ativo na própria página, não nas abas abaixo dele.
        const dentro = (href: string) => caminho === href || caminho.startsWith(`${href}/`);
        const ativa = a.href === "/comercial" ? caminho === a.href : "grupo" in a && a.grupo ? a.grupo.some(dentro) : dentro(a.href);
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
