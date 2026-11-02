import { CheckSquareIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EventoAgenda } from "../servicos/eventos";
import type { TarefaNaAgenda } from "../servicos/tarefas-na-agenda";

/** Item unificado das visões: evento institucional, tarefa com entrega ou evento da agenda pessoal. */
export type ItemAgenda = {
  id: string;
  tipo: "evento" | "tarefa" | "pessoal";
  titulo: string;
  inicio: string;
  fim: string;
  horaInicio: string | null;
  horaFim: string | null;
  cor: string;
  href: string | null;
  /** Linha secundária na Lista (tipo, turma, local). */
  detalhe?: string;
};

export const COR_TAREFA = "#5F45F4";

type Busca = Record<string, string | string[] | undefined>;

/** `/agenda` com os parâmetros atuais e as mudanças (`null` remove). */
export function urlAgenda(busca: Busca, mudancas: Record<string, string | null>): string {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) if (typeof valor === "string" && valor) p.set(chave, valor);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null) p.delete(chave);
    else p.set(chave, valor);
  }
  const consulta = p.toString();
  return consulta ? `/agenda?${consulta}` : "/agenda";
}

export function itensDaAgenda(
  eventos: EventoAgenda[],
  tarefas: TarefaNaAgenda[],
  href: { evento: (id: string) => string; tarefa: (t: TarefaNaAgenda) => string },
): ItemAgenda[] {
  return [
    ...eventos.map(
      (e): ItemAgenda => ({
        id: e.id,
        tipo: "evento",
        titulo: e.titulo,
        inicio: e.dataInicio,
        fim: e.dataFim,
        horaInicio: e.horaInicio,
        horaFim: e.horaFim,
        cor: e.tipo.cor,
        href: href.evento(e.id),
        detalhe: [e.tipo.nome, e.turma, e.local].filter(Boolean).join(" · "),
      }),
    ),
    ...tarefas.map(
      (t): ItemAgenda => ({
        id: t.id,
        tipo: "tarefa",
        titulo: t.titulo,
        inicio: t.dataEntrega,
        fim: t.dataEntrega,
        horaInicio: null,
        horaFim: null,
        cor: COR_TAREFA,
        href: href.tarefa(t),
        detalhe: "Entrega de tarefa",
      }),
    ),
  ];
}

/** Fundo tingido com a cor do item, legível no claro e no escuro. A agenda pessoal tem traço mais leve. */
export function estiloDoItem(item: Pick<ItemAgenda, "tipo" | "cor">): CSSProperties {
  const tom = item.tipo === "pessoal" ? 8 : 18;
  return { backgroundColor: `color-mix(in oklab, ${item.cor} ${tom}%, var(--background))`, borderColor: item.cor };
}

export function Clicavel({ href, className, style, title, children }: { href: string | null; className?: string; style?: CSSProperties; title?: string; children: ReactNode }) {
  if (!href) {
    return (
      <div className={className} style={style} title={title}>
        {children}
      </div>
    );
  }
  return (
    <Link href={href} scroll={false} className={className} style={style} title={title}>
      {children}
    </Link>
  );
}

export function IconeItem({ item, className }: { item: Pick<ItemAgenda, "tipo">; className?: string }) {
  if (item.tipo !== "tarefa") return null;
  return <CheckSquareIcon className={cn("size-3 shrink-0", className)} style={{ color: COR_TAREFA }} aria-label="Tarefa" />;
}

export function rotuloHora(item: Pick<ItemAgenda, "horaInicio" | "horaFim">): string {
  if (item.horaInicio === null) return "Dia inteiro";
  return item.horaFim ? `${item.horaInicio}–${item.horaFim}` : item.horaInicio;
}

export function dicaDoItem(item: ItemAgenda): string {
  return [item.titulo, item.horaInicio ? rotuloHora(item) : null, item.detalhe].filter(Boolean).join(" · ");
}

/** Faixa de um item na grade (Mês e topo da Semana). Cantos retos do lado em que continua. */
export function FaixaItem({ item, continuaAntes, continuaDepois, mostrarHora }: { item: ItemAgenda; continuaAntes: boolean; continuaDepois: boolean; mostrarHora: boolean }) {
  return (
    <Clicavel
      href={item.href}
      title={dicaDoItem(item)}
      style={estiloDoItem(item)}
      className={cn(
        "flex h-full min-w-0 items-center gap-1 overflow-hidden rounded-md border-l-[3px] px-1 text-[11px] leading-tight hover:brightness-95 sm:px-1.5 sm:text-xs dark:hover:brightness-125",
        item.tipo === "pessoal" && "border-dashed",
        continuaAntes && "rounded-l-none border-l-0",
        continuaDepois && "rounded-r-none",
      )}
    >
      <IconeItem item={item} />
      {mostrarHora && item.horaInicio && <span className="text-muted-foreground hidden shrink-0 tabular-nums sm:inline">{item.horaInicio}</span>}
      <span className="truncate font-medium">{item.titulo}</span>
    </Clicavel>
  );
}
