import { ClapperboardIcon } from "lucide-react";
import Link from "next/link";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { cn } from "@/lib/utils";
import { Avatares, DataEntrega, formatarDiaEntrega } from "@/modulos/tarefas/componentes/exibicao";
import { ROTULO_FORMATO, ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";
import { conteudoAtrasado } from "../regras/calendario";
import { COR_ETAPA, ROTULO_ETAPA, type Etapa } from "../regras/etapas";
import type { CartaoConteudo } from "../servicos/conteudos";
import { ChipPublicacao } from "./chip-publicacao";
import { SeloPlataforma } from "./selo-plataforma";

export { DataEntrega, formatarDiaEntrega };
export { SeloPlataforma, ChipPublicacao };

/** Chip da etapa, na cor da etapa (dado) com texto do tema. */
export function BadgeEtapa({ etapa, tamanho = "sm" }: { etapa: Etapa; tamanho?: "sm" | "md" }) {
  return (
    <ChipSituacao cor={COR_ETAPA[etapa]} tamanho={tamanho}>
      {ROTULO_ETAPA[etapa]}
    </ChipSituacao>
  );
}

export function NomeCanal({ plataforma, identificador }: { plataforma: Plataforma; identificador: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <SeloPlataforma plataforma={plataforma} />
      <span className="truncate">{ROTULO_PLATAFORMA[plataforma]}</span>
      {identificador && <span className="text-muted-foreground truncate">{identificador}</span>}
    </span>
  );
}

/** Cartão de conteúdo usado no quadro, na visão geral e nas gravações. `agora` fixa a data em prévias. */
export function Cartao({
  item,
  mostrarGravacao,
  acoes,
  agora = new Date(),
}: {
  item: CartaoConteudo;
  mostrarGravacao?: boolean;
  acoes?: React.ReactNode;
  agora?: Date;
}) {
  const atrasado = conteudoAtrasado(item.dataPublicacao, item.etapa, agora);
  return (
    <article
      className={cn(
        "bg-card text-card-foreground hover:bg-muted/50 grid min-w-0 gap-2 rounded-xl border p-3 text-sm transition-colors",
        atrasado && "border-perigo/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-xs">
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.marca.cor }} />
        <span className="text-muted-foreground truncate">{item.marca.nome}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground shrink-0">{ROTULO_FORMATO[item.formato]}</span>
        <span className="ml-auto shrink-0">
          <BadgeEtapa etapa={item.etapa} />
        </span>
      </div>
      <Link
        href={`/conteudo/itens/${item.id}`}
        className="text-foreground focus-visible:ring-ring rounded-sm leading-snug font-medium break-words hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {item.titulo}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1">
          {item.publicacoes.map((p, i) => (
            <SeloPlataforma key={i} plataforma={p.canal.plataforma} publicado={p.status === "publicado"} />
          ))}
        </span>
        <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-xs">
          {mostrarGravacao && item.dataGravacao && (
            <ChipSituacao tom="informacao" icone={ClapperboardIcon} tamanho="sm">
              <span className="sr-only">Gravação em </span>
              {formatarDiaEntrega(item.dataGravacao)}
            </ChipSituacao>
          )}
          <ChipPublicacao dataPublicacao={item.dataPublicacao} etapa={item.etapa} agora={agora} />
          {item.responsavel && <Avatares pessoas={[item.responsavel]} />}
        </span>
      </div>
      {acoes}
    </article>
  );
}
