"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ItemConfiguracao = { href: string; rotulo: string };

/** Itens da aba Configurações do Comercial, conforme o que a pessoa pode mexer. */
export function itensConfiguracao(p: { canais: boolean; meta: boolean; avisoVenda: boolean }): ItemConfiguracao[] {
  return [
    ...(p.canais ? [{ href: "/comercial/canais", rotulo: "Canais" }] : []),
    ...(p.meta ? [{ href: "/comercial/integracao-meta", rotulo: "Meta Ads" }] : []),
    ...(p.avisoVenda ? [{ href: "/comercial/aviso-venda", rotulo: "Aviso de venda" }] : []),
  ];
}

/** Pílulas de navegação dentro de Configurações (Canais | Meta Ads | Aviso de venda). */
export function SubabasConfiguracoes({ itens }: { itens: ItemConfiguracao[] }) {
  const caminho = usePathname();
  if (itens.length < 2) return null;
  return (
    <nav aria-label="Configurações do Comercial" className="bg-muted flex w-fit flex-wrap gap-1 rounded-full p-1">
      {itens.map((i) => {
        const ativa = caminho === i.href || caminho.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm",
              ativa ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
