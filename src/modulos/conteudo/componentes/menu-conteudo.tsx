"use client";

import { ChevronDownIcon, PlugIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PerfilInstagramMenu } from "../servicos/visao-instagram";
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

type Props = { perfis: PerfilInstagramMenu[]; podeConfigurar: boolean; podeIntegrar?: boolean };

/** Ícone do Instagram (contorno da câmera), na cor do texto. */
function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function Conteudo({ perfis, podeConfigurar, podeIntegrar }: Props) {
  const caminho = usePathname();
  const busca = useSearchParams();
  const naRelatorios = caminho === "/conteudo/relatorios";
  const contaAberta = naRelatorios ? busca.get("conta") : null;

  return (
    <nav aria-label="Conteúdo" className="grid gap-4">
      <BotaoNovoConteudo className="w-full" />
      <div className="grid gap-0.5">
        {VISOES.map((v) => {
          // Relatórios fica marcado só na visão de todos os perfis; um perfil aberto marca o perfil.
          const atual = caminho === v.href && !(v.href === "/conteudo/relatorios" && contaAberta);
          return (
            <Link
              key={v.href}
              href={v.href}
              aria-current={atual ? "page" : undefined}
              className={cn(estiloItem, atual && "bg-muted font-medium")}
            >
              {v.rotulo}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-0.5">
        <div className="flex items-center justify-between px-2">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Instagram</p>
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
        {perfis.length === 0 && <p className="text-muted-foreground px-2 py-1 text-sm">Nenhum perfil conectado ainda.</p>}
        {/* Cada perfil conectado abre as métricas dele nos Relatórios. */}
        {perfis.map((p) => (
          <Link
            key={p.id}
            href={`/conteudo/relatorios?conta=${p.id}`}
            aria-current={contaAberta === p.id ? "page" : undefined}
            className={cn(estiloItem, contaAberta === p.id && "bg-muted font-medium")}
          >
            <IconeInstagram className="size-4 shrink-0" />
            <span className="truncate">@{p.usuario}</span>
          </Link>
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
          Conteúdo: visões e perfis
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="px-2 pb-3">
          <Conteudo {...props} />
        </div>
      </details>
    </>
  );
}
