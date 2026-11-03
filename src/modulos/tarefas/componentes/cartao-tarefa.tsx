"use client";

import { ArrowRightLeftIcon, CheckCircle2Icon, CheckIcon, ListTreeIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { cn } from "@/lib/utils";
import type { TarefaResumo } from "../servicos/tarefas";
import { SeloEtiqueta } from "./etiquetas";
import { ChipPrazo } from "./chips-tarefa";
import { Avatares, ChipPrioridade, PontoCor, formatarDiaEntrega } from "./exibicao";

export type StatusQuadro = { id: string; nome: string; cor: string; tipo: string };

/** Anel de progresso do checklist, com "feitos/total" ao lado. */
function AnelChecklist({ feitos, total }: { feitos: number; total: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const completo = feitos === total;
  return (
    <span className="inline-flex items-center gap-1" title={`Checklist: ${feitos} de ${total} itens feitos`}>
      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 -rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-muted-foreground/25" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * feitos) / total}
          className={cn("transition-[stroke-dashoffset] duration-300", completo ? "stroke-sucesso" : "stroke-primary")}
        />
      </svg>
      <span className={cn("text-[11.5px] tabular-nums", completo ? "text-sucesso" : "text-muted-foreground")}>
        {feitos}/{total}
      </span>
      <span className="sr-only">itens do checklist feitos</span>
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
  const itens = tarefa.checklist.length;
  const itensFeitos = tarefa.checklist.filter((i) => i.concluido).length;
  const etiquetas = tarefa.etiquetas.map((e) => e.etiqueta);

  const comRodape = Boolean(tarefa.dataEntrega) || itens > 0 || (subtarefas?.total ?? 0) > 0 || concluida || tarefa.responsaveis.length > 0;

  return (
    <article
      className={cn(
        "group bg-card text-card-foreground border-border relative min-w-0 rounded-xl border p-3 shadow-xs transition hover:-translate-y-px hover:shadow-md",
        pendente && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-h-[22px] min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <ChipPrioridade prioridade={tarefa.prioridade} />
          {etiquetas.slice(0, 2).map((e) => (
            <SeloEtiqueta key={e.id} etiqueta={e} className="h-[22px] max-w-28 rounded-[7px] px-2 py-0 text-[11px] leading-none" />
          ))}
          {etiquetas.length > 2 && <span className="text-muted-foreground text-[11px] tabular-nums">+{etiquetas.length - 2}</span>}
        </div>
        <div className="relative z-10 -mt-0.5 -mr-1 flex shrink-0 items-center">
          {statusConcluido && !concluida && (
            <button
              type="button"
              aria-label={`Concluir "${tarefa.titulo}"`}
              title="Concluir"
              disabled={pendente}
              onClick={() => mover(statusConcluido.id)}
              className="grid size-6 place-items-center rounded-[7px] text-muted-foreground opacity-100 transition-colors hover:bg-sucesso-suave hover:text-sucesso md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <CheckIcon className="size-3.5" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Mover "${tarefa.titulo}"`}
                disabled={pendente}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 grid size-6 place-items-center rounded-[7px] transition-colors outline-none focus-visible:ring-[3px]"
              >
                <MoreHorizontalIcon className="size-3.5" />
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

      <Link
        href={href}
        scroll={false}
        className={cn(
          "mt-2.5 line-clamp-3 block text-sm leading-snug font-medium tracking-[-0.005em] outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring",
          concluida && "text-muted-foreground line-through",
        )}
      >
        {tarefa.tarefaPaiId && <span className="text-muted-foreground mr-1 font-normal no-underline">↳</span>}
        {tarefa.titulo}
      </Link>

      {comRodape && (
        <>
          <div className="bg-border mt-3 h-px" />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              {tarefa.dataEntrega && (
                <span title={`Entrega: ${formatarDiaEntrega(tarefa.dataEntrega)}`} className="inline-flex min-w-0">
                  <ChipPrazo dataEntrega={tarefa.dataEntrega} concluidaEm={tarefa.concluidaEm} />
                </span>
              )}
              {itens > 0 && <AnelChecklist feitos={itensFeitos} total={itens} />}
              {subtarefas && subtarefas.total > 0 && (
                <span
                  className="text-muted-foreground inline-flex items-center gap-1 text-[11.5px] tabular-nums"
                  title={`${subtarefas.concluidas} de ${subtarefas.total} subtarefas concluídas`}
                >
                  <ListTreeIcon className="size-3" strokeWidth={2.25} aria-hidden /> {subtarefas.concluidas}/{subtarefas.total}
                </span>
              )}
              {/* Com data, o chip de prazo já diz "Concluída". */}
              {concluida && !tarefa.dataEntrega && (
                <ChipSituacao tom="sucesso" icone={CheckCircle2Icon} tamanho="sm">
                  Concluída
                </ChipSituacao>
              )}
            </span>
            {tarefa.responsaveis.length > 0 && <Avatares pessoas={tarefa.responsaveis.map((r) => r.usuario)} />}
          </div>
        </>
      )}
    </article>
  );
}
