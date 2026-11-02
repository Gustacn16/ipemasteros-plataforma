"use client";

import { ChevronDownIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/componentes/ui/button";
import { cn } from "@/lib/utils";
import { ROTULO_PLATAFORMA } from "../esquemas/conteudo";
import type { Conta } from "../servicos/contas";
import { SeloPlataforma } from "./selo-plataforma";
import { NovoConteudo } from "./novo-conteudo";

const VISOES = [
  { href: "/conteudo", rotulo: "Visão geral" },
  { href: "/conteudo/planejamento", rotulo: "Planejamento" },
  { href: "/conteudo/calendario", rotulo: "Calendário" },
  { href: "/conteudo/gravacoes", rotulo: "Gravações" },
  { href: "/conteudo/publicados", rotulo: "Publicados" },
];

const estiloItem = "hover:bg-muted flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm";

function Conteudo({ contas, podeConfigurar }: { contas: Conta[]; podeConfigurar: boolean }) {
  const caminho = usePathname();
  const busca = useSearchParams();
  const marca = busca.get("marca");
  const canal = busca.get("canal");
  // As visões mantêm o filtro de conta; o detalhe e as configurações voltam para a visão geral.
  const ehVisao = VISOES.some((v) => v.href === caminho);
  const base = ehVisao ? caminho : "/conteudo";
  const comFiltro = (href: string) => {
    const p = new URLSearchParams();
    if (marca) p.set("marca", marca);
    if (canal) p.set("canal", canal);
    return p.size ? `${href}?${p}` : href;
  };
  const filtrar = (params: Record<string, string>) => {
    const p = new URLSearchParams(params);
    const mes = busca.get("mes");
    if (mes && ehVisao) p.set("mes", mes);
    return `${base}?${p}`;
  };

  return (
    <nav aria-label="Conteúdo" className="grid gap-4">
      <NovoConteudo
        contas={contas}
        marcaPadrao={marca ?? undefined}
        gatilho={
          <Button size="sm" className="w-full">
            <PlusIcon /> Novo conteúdo
          </Button>
        }
      />
      <div className="grid gap-0.5">
        {VISOES.map((v) => (
          <Link
            key={v.href}
            href={comFiltro(v.href)}
            aria-current={caminho === v.href ? "page" : undefined}
            className={cn(estiloItem, caminho === v.href && "bg-muted font-medium")}
          >
            {v.rotulo}
          </Link>
        ))}
      </div>

      <div className="grid gap-0.5">
        <div className="flex items-center justify-between px-2">
          <p className="text-muted-foreground text-xs font-medium uppercase">Contas</p>
          {podeConfigurar && (
            <Link href="/conteudo/configuracoes" className="text-muted-foreground hover:text-foreground rounded p-1" aria-label="Configurar contas e canais">
              <SettingsIcon className="size-3.5" />
            </Link>
          )}
        </div>
        <Link href={base} className={cn(estiloItem, !marca && !canal && "font-medium")}>
          Todas as contas
        </Link>
        {contas.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-sm">
            {podeConfigurar ? "Cadastre as contas na engrenagem." : "Nenhuma conta cadastrada ainda."}
          </p>
        )}
        {contas.map((c) => (
          <div key={c.id} className="grid gap-0.5">
            <Link
              href={filtrar({ marca: c.id })}
              aria-current={marca === c.id && !canal ? "true" : undefined}
              className={cn(estiloItem, "font-medium", marca === c.id && !canal && "bg-muted")}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
              {c.nome}
            </Link>
            {c.canais.map((k) => (
              <Link
                key={k.id}
                href={filtrar({ canal: k.id })}
                aria-current={canal === k.id ? "true" : undefined}
                className={cn(estiloItem, "pl-6", canal === k.id && "bg-muted font-medium")}
              >
                <SeloPlataforma plataforma={k.plataforma} />
                {ROTULO_PLATAFORMA[k.plataforma]}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

/** Menu interno do módulo Conteúdo (fixo na tela larga, recolhível no celular). */
export function MenuConteudo(props: { contas: Conta[]; podeConfigurar: boolean }) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
        <p className="mb-4 px-2 text-sm font-semibold">Conteúdo</p>
        <Conteudo {...props} />
      </aside>
      <details className="group border-b md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
          Conteúdo: visões e contas
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="px-2 pb-3">
          <Conteudo {...props} />
        </div>
      </details>
    </>
  );
}
