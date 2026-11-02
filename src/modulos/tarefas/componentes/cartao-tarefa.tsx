"use client";

import { ArrowRightLeftIcon, CalendarIcon, CheckCircle2Icon, CheckIcon, ListTreeIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ROTULO_PRIORIDADE, type Prioridade } from "../esquemas/tarefa";
import { situacaoEntrega, type TomEntrega } from "../regras/prazo";
import type { TarefaResumo } from "../servicos/tarefas";
import { Avatares, PontoCor, formatarDiaEntrega } from "./exibicao";

export type StatusQuadro = { id: string; nome: string; cor: string; tipo: string };

const FAIXA_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "border-l-red-500",
  alta: "border-l-orange-400",
  normal: "border-l-transparent",
  baixa: "border-l-sky-300",
};

const SELO_PRIORIDADE: Partial<Record<Prioridade, string>> = {
  urgente: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  baixa: "bg-sky-50 text-sky-700",
};

const ESTILO_ENTREGA: Record<TomEntrega, string> = {
  atrasada: "bg-red-50 text-red-700 ring-red-200",
  hoje: "bg-amber-50 text-amber-800 ring-amber-200",
  amanha: "bg-violet-50 text-violet-700 ring-violet-200",
  proxima: "bg-muted text-foreground ring-transparent",
  futura: "text-muted-foreground ring-transparent",
  concluida: "text-muted-foreground ring-transparent",
};

function textoEntrega(tom: TomEntrega, dias: number, data: Date): string {
  if (tom === "atrasada") return dias === -1 ? "Atrasada 1 dia" : `Atrasada ${-dias} dias`;
  if (tom === "hoje") return "Entrega hoje";
  if (tom === "amanha") return "Amanhã";
  if (tom === "proxima") return `Em ${dias} dias`;
  return formatarDiaEntrega(data);
}

function Entrega({ data, concluidaEm }: { data: Date; concluidaEm: Date | null }) {
  const { tom, dias } = situacaoEntrega(data, concluidaEm, new Date());
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", ESTILO_ENTREGA[tom])}
      title={`Entrega: ${formatarDiaEntrega(data)}`}
    >
      <CalendarIcon className="size-3" aria-hidden />
      {textoEntrega(tom, dias, data)}
    </span>
  );
}

type Props = {
  tarefa: TarefaResumo;
  href: string;
  status: StatusQuadro[];
  /** Subtarefas concluídas / total (só tarefas principais). */
  subtarefas?: { concluidas: number; total: number };
  pendente?: boolean;
  mover: (statusId: string) => void;
};

/** Cartão do Quadro: o cartão inteiro abre a tarefa; o menu ⋯ e o ✓ agem sem abrir. */
export function CartaoTarefa({ tarefa, href, status, subtarefas, pendente, mover }: Props) {
  const concluida = Boolean(tarefa.concluidaEm);
  const statusConcluido = status.find((s) => s.tipo === "concluido");
  const selo = SELO_PRIORIDADE[tarefa.prioridade];

  return (
    <article
      className={cn(
        "group bg-card relative grid gap-2.5 rounded-lg border border-l-4 p-3 shadow-xs transition hover:-translate-y-px hover:shadow-md",
        FAIXA_PRIORIDADE[tarefa.prioridade],
        pendente && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={href}
          scroll={false}
          className={cn(
            "line-clamp-3 flex-1 text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-[#5F45F4]",
            concluida && "text-muted-foreground line-through",
          )}
        >
          {tarefa.tarefaPaiId && <span className="text-muted-foreground mr-1 font-normal no-underline">↳</span>}
          {tarefa.titulo}
        </Link>
        <div className="relative z-10 -mt-1 -mr-1 flex shrink-0 items-center">
          {statusConcluido && !concluida && (
            <button
              type="button"
              aria-label={`Concluir "${tarefa.titulo}"`}
              title="Concluir"
              disabled={pendente}
              onClick={() => mover(statusConcluido.id)}
              className="text-muted-foreground rounded-md p-1 opacity-100 hover:bg-green-50 hover:text-green-700 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <CheckIcon className="size-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Mover "${tarefa.titulo}"`}
                disabled={pendente}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1"
              >
                <MoreHorizontalIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ArrowRightLeftIcon className="size-3.5" /> Mover para
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {status.map((s) => (
                <DropdownMenuItem key={s.id} disabled={s.id === tarefa.statusId} onSelect={() => mover(s.id)}>
                  <PontoCor cor={s.cor} />
                  <span className="flex-1">{s.nome}</span>
                  {s.id === tarefa.statusId && <CheckIcon className="text-muted-foreground" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(selo || tarefa.dataEntrega) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selo && <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", selo)}>{ROTULO_PRIORIDADE[tarefa.prioridade]}</span>}
          {tarefa.dataEntrega && <Entrega data={tarefa.dataEntrega} concluidaEm={tarefa.concluidaEm} />}
        </div>
      )}

      {subtarefas && subtarefas.total > 0 && (
        <div className="grid gap-1" title={`${subtarefas.concluidas} de ${subtarefas.total} subtarefas concluídas`}>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <ListTreeIcon className="size-3.5" aria-hidden /> Subtarefas
            </span>
            <span>
              {subtarefas.concluidas}/{subtarefas.total}
            </span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
            <div className="h-full rounded-full bg-[#5F45F4] transition-all" style={{ width: `${(subtarefas.concluidas / subtarefas.total) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {concluida ? (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2Icon className="size-3.5" aria-hidden /> Concluída
          </span>
        ) : (
          <span />
        )}
        {tarefa.responsaveis.length > 0 ? (
          <Avatares pessoas={tarefa.responsaveis.map((r) => r.usuario)} />
        ) : (
          <span className="text-muted-foreground text-xs">Sem responsável</span>
        )}
      </div>
    </article>
  );
}
