import { ClapperboardIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatares, DataEntrega, formatarDiaEntrega } from "@/modulos/tarefas/componentes/exibicao";
import { ROTULO_FORMATO, ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";
import { conteudoAtrasado } from "../regras/calendario";
import { COR_ETAPA, ROTULO_ETAPA, type Etapa } from "../regras/etapas";
import type { CartaoConteudo } from "../servicos/conteudos";
import { SeloPlataforma } from "./selo-plataforma";

export { DataEntrega, formatarDiaEntrega };
export { SeloPlataforma };

export function BadgeEtapa({ etapa }: { etapa: Etapa }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: COR_ETAPA[etapa] }} />
      {ROTULO_ETAPA[etapa]}
    </span>
  );
}

export function NomeCanal({ plataforma, identificador }: { plataforma: Plataforma; identificador: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <SeloPlataforma plataforma={plataforma} />
      <span>{ROTULO_PLATAFORMA[plataforma]}</span>
      {identificador && <span className="text-muted-foreground">{identificador}</span>}
    </span>
  );
}

/** Cartão de conteúdo usado no quadro, na visão geral e nas gravações. */
export function Cartao({ item, mostrarGravacao, acoes }: { item: CartaoConteudo; mostrarGravacao?: boolean; acoes?: React.ReactNode }) {
  const atrasado = conteudoAtrasado(item.dataPublicacao, item.etapa, new Date());
  return (
    <article className={cn("bg-background grid gap-2 rounded-lg border p-3 text-sm shadow-xs", atrasado && "border-red-300")}>
      <div className="flex items-center gap-1.5 text-xs">
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: item.marca.cor }} />
        <span className="text-muted-foreground truncate">{item.marca.nome}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{ROTULO_FORMATO[item.formato]}</span>
      </div>
      <Link href={`/conteudo/itens/${item.id}`} className="leading-snug font-medium hover:underline">
        {item.titulo}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1">
          {item.publicacoes.map((p, i) => (
            <SeloPlataforma key={i} plataforma={p.canal.plataforma} publicado={p.status === "publicado"} />
          ))}
        </span>
        <span className="flex items-center gap-2 text-xs">
          {mostrarGravacao && item.dataGravacao && (
            <span title="Gravação" className="inline-flex items-center gap-1 text-orange-700">
              <ClapperboardIcon className="size-3.5" aria-hidden />
              <span className="sr-only">Gravação em </span>
              {formatarDiaEntrega(item.dataGravacao)}
            </span>
          )}
          {item.dataPublicacao && (
            <span title="Publicação prevista" className={cn(atrasado && "font-semibold text-red-600")}>
              {formatarDiaEntrega(item.dataPublicacao)}
              {atrasado && <span className="sr-only"> (atrasado)</span>}
            </span>
          )}
          {item.responsavel && <Avatares pessoas={[item.responsavel]} />}
        </span>
      </div>
      {acoes}
    </article>
  );
}
