"use client";

import { ChevronDownIcon, PlugIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/componentes/ui/button";
import { cn } from "@/lib/utils";
import { ROTULO_PLATAFORMA, type FiltroConteudo } from "../esquemas/conteudo";
import { useAplicarFiltro } from "./barra-filtros";
import type { Conta } from "../servicos/contas";
import { SeloPlataforma } from "./selo-plataforma";
import { NovoConteudo } from "./novo-conteudo";

const VISOES = [
  { href: "/conteudo", rotulo: "Visão geral" },
  { href: "/conteudo/planejamento", rotulo: "Planejamento" },
  { href: "/conteudo/calendario", rotulo: "Calendário" },
  { href: "/conteudo/gravacoes", rotulo: "Gravações" },
  { href: "/conteudo/publicados", rotulo: "Publicados" },
  { href: "/conteudo/relatorios", rotulo: "Relatórios" },
];

const estiloItem =
  "hover:bg-muted focus-visible:ring-ring flex w-full min-w-0 items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none";

type Props = { contas: Conta[]; podeConfigurar: boolean; podeIntegrar?: boolean; filtro: FiltroConteudo };

function Conteudo({ contas, podeConfigurar, podeIntegrar, filtro }: Props) {
  const caminho = usePathname();
  const router = useRouter();
  const { aplicar } = useAplicarFiltro();
  const { marca, canal } = filtro;
  // Fora das visões (detalhe, configurações), escolher uma conta leva para a visão geral.
  const ehVisao = VISOES.some((v) => v.href === caminho);
  const filtrar = (novo: Pick<FiltroConteudo, "marca" | "canal">) => {
    aplicar({ ...filtro, ...novo });
    if (!ehVisao) router.push("/conteudo");
  };

  return (
    <nav aria-label="Conteúdo" className="grid gap-4">
      <NovoConteudo
        contas={contas}
        marcaPadrao={marca}
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
            href={v.href}
            aria-current={caminho === v.href ? "page" : undefined}
            className={cn(estiloItem, caminho === v.href && "bg-muted font-medium")}
          >
            {v.rotulo}
          </Link>
        ))}
      </div>

      <div className="grid gap-0.5">
        <div className="flex items-center justify-between px-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Contas</p>
          {podeConfigurar && (
            <Link
              href="/conteudo/configuracoes"
              className="text-muted-foreground hover:text-foreground rounded p-1"
              aria-label="Configurar contas e canais"
            >
              <SettingsIcon className="size-3.5" />
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => filtrar({ marca: undefined, canal: undefined })}
          className={cn(estiloItem, !marca && !canal && "font-medium")}
        >
          Todas as contas
        </button>
        {contas.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-sm">
            {podeConfigurar ? "Cadastre as contas na engrenagem." : "Nenhuma conta cadastrada ainda."}
          </p>
        )}
        {contas.map((c) => (
          <div key={c.id} className="grid gap-0.5">
            <button
              type="button"
              onClick={() => filtrar({ marca: c.id, canal: undefined })}
              aria-pressed={marca === c.id && !canal}
              className={cn(estiloItem, "font-medium", marca === c.id && !canal && "bg-muted")}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
              <span className="truncate">{c.nome}</span>
            </button>
            {c.canais.map((k) => (
              <button
                type="button"
                key={k.id}
                onClick={() => filtrar({ marca: c.id, canal: k.id })}
                aria-pressed={canal === k.id}
                className={cn(estiloItem, "pl-6", canal === k.id && "bg-muted font-medium")}
              >
                <SeloPlataforma plataforma={k.plataforma} />
                <span className="truncate">{ROTULO_PLATAFORMA[k.plataforma]}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {podeIntegrar && (
        <Link
          href="/conteudo/integracao-instagram"
          aria-current={caminho === "/conteudo/integracao-instagram" ? "page" : undefined}
          className={cn(
            estiloItem,
            "text-muted-foreground",
            caminho === "/conteudo/integracao-instagram" && "bg-muted text-foreground font-medium",
          )}
        >
          <PlugIcon className="size-3.5" aria-hidden /> Integração Instagram
        </Link>
      )}
    </nav>
  );
}

/** Menu interno do módulo Conteúdo (fixo na tela larga, recolhível no celular). */
export function MenuConteudo(props: Props) {
  return (
    <>
      <aside className="bg-card hidden w-60 shrink-0 border-r p-4 md:block">
        <p className="mb-4 px-2 text-sm font-semibold">Conteúdo</p>
        <Conteudo {...props} />
      </aside>
      <details className="group bg-card border-b md:hidden">
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
