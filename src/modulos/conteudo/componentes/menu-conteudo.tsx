"use client";

import { ChevronDownIcon, PlugIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROTULO_PLATAFORMA, type FiltroConteudo } from "../esquemas/conteudo";
import { useAplicarFiltro } from "./barra-filtros";
import type { Conta } from "../servicos/contas";
import { SeloPlataforma } from "./selo-plataforma";
import { BotaoNovoConteudo } from "./novo-conteudo";

const VISOES = [
  { href: "/conteudo/relatorios", rotulo: "Relatórios" },
  { href: "/conteudo/planejamento", rotulo: "Planejamento" },
  { href: "/conteudo/calendario", rotulo: "Calendário" },
  { href: "/conteudo/gravacoes", rotulo: "Gravações" },
  { href: "/conteudo/publicados", rotulo: "Publicados" },
];

const estiloItem =
  "hover:bg-muted focus-visible:ring-ring flex w-full min-w-0 items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none";

type Props = { contas: Conta[]; podeConfigurar: boolean; podeIntegrar?: boolean; filtro: FiltroConteudo };

function Conteudo({ contas, podeConfigurar, podeIntegrar, filtro }: Props) {
  const caminho = usePathname();
  const router = useRouter();
  const { aplicar } = useAplicarFiltro();
  const { marca, canal, formato } = filtro;
  // Fora das visões (detalhe, configurações), escolher uma conta leva para os Relatórios.
  const ehVisao = VISOES.some((v) => v.href === caminho);
  const filtrar = (novo: Pick<FiltroConteudo, "marca" | "canal" | "formato">) => {
    aplicar({ ...filtro, formato: undefined, ...novo });
    if (!ehVisao) router.push("/conteudo/relatorios");
  };

  return (
    <nav aria-label="Conteúdo" className="grid gap-4">
      <BotaoNovoConteudo className="w-full" />
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
              <div key={k.id} className="grid gap-0.5">
                <button
                  type="button"
                  onClick={() => filtrar({ marca: c.id, canal: k.id })}
                  aria-pressed={canal === k.id && !formato}
                  className={cn(estiloItem, "pl-6", canal === k.id && !formato && "bg-muted font-medium")}
                >
                  <SeloPlataforma plataforma={k.plataforma} />
                  <span className="truncate">{ROTULO_PLATAFORMA[k.plataforma]}</span>
                </button>
                {/* Formatos do canal: o jeito de organizar o trabalho (ex.: YouTube → Entrevista). */}
                {canal === k.id &&
                  k.formatos.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => filtrar({ marca: c.id, canal: k.id, formato: f.id })}
                    aria-pressed={formato === f.id}
                    className={cn(
                      estiloItem,
                      "text-muted-foreground pl-12 text-xs",
                      formato === f.id && "bg-muted text-foreground font-medium",
                    )}
                  >
                    <span className="truncate">{f.nome}</span>
                  </button>
                ))}
              </div>
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
