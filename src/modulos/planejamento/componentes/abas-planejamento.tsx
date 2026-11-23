"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Aba = { href: string; rotulo: string; ativa: boolean };

export function AbasPlanejamento({ ver, editor }: { ver: boolean; editor: boolean }) {
  const caminho = usePathname();
  const busca = useSearchParams();
  const ano = busca.get("ano");
  const comAno = (href: string) => (ano ? `${href}?ano=${ano}` : href);
  const visao: Aba[] = ver
    ? [
        { href: "/planejamento", rotulo: "Painel", ativa: caminho === "/planejamento" },
        { href: "/planejamento/comercial", rotulo: "Comercial", ativa: caminho.startsWith("/planejamento/comercial") },
        { href: "/planejamento/marketing", rotulo: "Marketing", ativa: caminho.startsWith("/planejamento/marketing") },
      ]
    : [];
  const cadastro: Aba[] = [
    ...(editor ? [{ href: "/planejamento/cadastro/premissas", rotulo: "Cadastrar", ativa: caminho.startsWith("/planejamento/cadastro") }] : []),
    { href: "/planejamento/lancar", rotulo: "Lançar resultados", ativa: caminho.startsWith("/planejamento/lancar") },
  ];
  const link = (a: Aba) => (
    <Link
      key={a.href}
      href={comAno(a.href)}
      aria-current={a.ativa ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
        a.ativa ? "border-primary text-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      {a.rotulo}
    </Link>
  );
  return (
    <nav aria-label="Planejamento" className="flex items-end gap-1 overflow-x-auto border-b">
      {visao.length > 0 && (
        <>
          <span className="text-muted-foreground self-center pr-1 text-[11px] tracking-wide uppercase">Ver</span>
          {visao.map(link)}
          <span aria-hidden className="bg-border mx-2 h-5 w-px self-center" />
        </>
      )}
      <span className="text-muted-foreground self-center pr-1 text-[11px] tracking-wide uppercase">Preencher</span>
      {cadastro.map(link)}
    </nav>
  );
}

export function SubabasCadastro() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const ano = busca.get("ano");
  const abas = [
    { href: "/planejamento/cadastro/premissas", rotulo: "Premissas" },
    { href: "/planejamento/cadastro/turmas", rotulo: "Turmas e metas avulsas" },
    { href: "/planejamento/cadastro/indicadores", rotulo: "Indicadores e metas" },
  ];
  return (
    <nav aria-label="Cadastro do plano" className="flex flex-wrap gap-2">
      {abas.map((a) => (
        <Link
          key={a.href}
          href={ano ? `${a.href}?ano=${ano}` : a.href}
          aria-current={caminho === a.href ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            caminho === a.href ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
          )}
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
