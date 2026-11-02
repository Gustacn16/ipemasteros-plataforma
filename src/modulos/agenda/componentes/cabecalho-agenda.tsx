"use client";

import { CalendarDaysIcon, CalendarRangeIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { FiltroAgenda } from "../esquemas/agenda";
import type { VisaoAgenda } from "../regras/periodo";
import { useAplicarFiltroAgenda } from "./barra-camadas";

const OPCOES = [
  { valor: "mes", rotulo: "Mês", icone: CalendarDaysIcon },
  { valor: "semana", rotulo: "Semana", icone: CalendarRangeIcon },
  { valor: "lista", rotulo: "Lista", icone: ListIcon },
] as const;

const ROTULO_PASSO: Record<VisaoAgenda, [string, string]> = {
  mes: ["Mês anterior", "Próximo mês"],
  semana: ["Semana anterior", "Próxima semana"],
  lista: ["60 dias antes", "60 dias depois"],
};

type Props = {
  visao: VisaoAgenda;
  titulo: string;
  filtro: FiltroAgenda;
  /** Query string atual, sem "?". */
  consulta: string;
  hrefAnterior: string;
  hrefProximo: string;
  hrefHoje: string;
  emHoje: boolean;
  children?: React.ReactNode;
};

/** Hoje, ‹ ›, título do período e Mês/Semana/Lista. A visão escolhida fica salva no cookie. */
export function CabecalhoAgenda({ visao, titulo, filtro, consulta, hrefAnterior, hrefProximo, hrefHoje, emHoje, children }: Props) {
  const router = useRouter();
  const { aplicar, pendente } = useAplicarFiltroAgenda();
  const [anterior, proximo] = ROTULO_PASSO[visao];

  function escolher(nova: VisaoAgenda) {
    if (nova === visao) return;
    const params = new URLSearchParams(consulta);
    // Com ?visao= na URL, ela mandaria; tira para valer a escolha salva.
    if (params.has("visao")) {
      params.delete("visao");
      const destino = params.toString() ? `/agenda?${params}` : "/agenda";
      aplicar({ ...filtro, visao: nova }, () => router.push(destino, { scroll: false }));
    } else {
      aplicar({ ...filtro, visao: nova });
    }
  }

  const seta = "hover:bg-muted inline-flex size-8 items-center justify-center rounded-md border";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Link
          href={hrefHoje}
          className={cn("hover:bg-muted inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium", emHoje && "text-muted-foreground")}
        >
          Hoje
        </Link>
        <div className="flex items-center gap-1">
          <Link href={hrefAnterior} className={seta} aria-label={anterior} title={anterior}>
            <ChevronLeftIcon className="size-4" />
          </Link>
          <Link href={hrefProximo} className={seta} aria-label={proximo} title={proximo}>
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
        <h1 className="min-w-0 text-lg font-semibold tracking-tight sm:text-xl">{titulo}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Link href="/agenda/configuracoes" className="hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium">
          <SettingsIcon className="size-4" aria-hidden /> Configurações
        </Link>
        <div role="group" aria-label="Visualização" className={cn("bg-muted inline-flex rounded-lg p-0.5", pendente && "opacity-60")}>
          {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={visao === valor}
              disabled={pendente}
              onClick={() => escolher(valor)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm",
                visao === valor ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="size-4" aria-hidden />
              {rotulo}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/** Sem visão na URL nem no cookie, o celular abre na Lista. */
export function VisaoPadraoCelular({ consulta }: { consulta: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const params = new URLSearchParams(consulta);
    params.set("visao", "lista");
    router.replace(`/agenda?${params}`, { scroll: false });
  }, [consulta, router]);
  return null;
}
