"use client";

import { ArrowRightLeftIcon, CalendarDaysIcon, CheckCircle2Icon, CheckIcon, FlagIcon, ListTreeIcon, MoreHorizontalIcon } from "lucide-react";
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
import { SeloEtiqueta } from "./etiquetas";
import { Avatares, PontoCor, formatarDiaEntrega } from "./exibicao";

export type StatusQuadro = { id: string; nome: string; cor: string; tipo: string };

/** Selo de altura fixa, sem caixa de linha, para ícone e texto ficarem centrados. */
const SELO = "inline-flex h-[22px] items-center gap-1 rounded-[7px] px-2 text-[11px] leading-none font-medium";

const SELO_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "bg-rose-50 text-rose-600",
  alta: "bg-amber-50 text-amber-700",
  normal: "bg-blue-50 text-blue-600",
  baixa: "bg-neutral-100 text-neutral-500",
};

const COR_ENTREGA: Record<TomEntrega, string> = {
  atrasada: "font-medium text-red-600",
  hoje: "font-medium text-amber-600",
  amanha: "text-amber-600",
  proxima: "text-neutral-600",
  futura: "text-neutral-500",
  concluida: "text-neutral-400",
};

function textoEntrega(tom: TomEntrega, dias: number, data: Date): string {
  if (tom === "atrasada") return dias === -1 ? "Atrasada 1 dia" : `Atrasada ${-dias} dias`;
  if (tom === "hoje") return "Hoje";
  if (tom === "amanha") return "Amanhã";
  if (tom === "proxima") return `Em ${dias} dias`;
  return formatarDiaEntrega(data);
}

function Entrega({ data, concluidaEm }: { data: Date; concluidaEm: Date | null }) {
  const { tom, dias } = situacaoEntrega(data, concluidaEm, new Date());
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11.5px] tabular-nums", COR_ENTREGA[tom])} title={`Entrega: ${formatarDiaEntrega(data)}`}>
      <CalendarDaysIcon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
      {textoEntrega(tom, dias, data)}
    </span>
  );
}

/** Anel de progresso do checklist, com "feitos/total" ao lado. */
function AnelChecklist({ feitos, total }: { feitos: number; total: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const completo = feitos === total;
  return (
    <span className="inline-flex items-center gap-1" title={`Checklist: ${feitos} de ${total} itens feitos`}>
      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 -rotate-90">
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-black/[0.09]" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * feitos) / total}
          className={cn("transition-[stroke-dashoffset] duration-300", completo ? "stroke-emerald-500" : "stroke-[#5F45F4]")}
        />
      </svg>
      <span className={cn("text-[11.5px] tabular-nums", completo ? "text-emerald-600" : "text-neutral-500")}>
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
        "group bg-card relative rounded-xl border border-black/[0.06] p-3 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition hover:-translate-y-px hover:shadow-[0_8px_20px_-10px_rgb(0_0_0/0.25)]",
        pendente && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-h-[22px] min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className={cn(SELO, SELO_PRIORIDADE[tarefa.prioridade])}>
            <FlagIcon className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
            {ROTULO_PRIORIDADE[tarefa.prioridade]}
          </span>
          {etiquetas.slice(0, 2).map((e) => (
            <SeloEtiqueta key={e.id} etiqueta={e} className="h-[22px] max-w-28 rounded-[7px] px-2 py-0 text-[11px] leading-none" />
          ))}
          {etiquetas.length > 2 && <span className="text-[11px] text-neutral-500">+{etiquetas.length - 2}</span>}
        </div>
        <div className="relative z-10 -mt-0.5 -mr-1 flex shrink-0 items-center">
          {statusConcluido && !concluida && (
            <button
              type="button"
              aria-label={`Concluir "${tarefa.titulo}"`}
              title="Concluir"
              disabled={pendente}
              onClick={() => mover(statusConcluido.id)}
              className="grid size-6 place-items-center rounded-[7px] text-neutral-400 opacity-100 transition-colors hover:bg-emerald-50 hover:text-emerald-700 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
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
                className="grid size-6 place-items-center rounded-[7px] text-neutral-400 transition-colors hover:bg-black/[0.06] hover:text-neutral-800"
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
          "mt-2.5 line-clamp-3 block text-sm leading-snug font-medium tracking-[-0.005em] outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-[#5F45F4]",
          concluida && "text-muted-foreground line-through",
        )}
      >
        {tarefa.tarefaPaiId && <span className="text-muted-foreground mr-1 font-normal no-underline">↳</span>}
        {tarefa.titulo}
      </Link>

      {comRodape && (
        <>
          <div className="mt-3 h-px bg-black/[0.06]" />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2.5">
              {tarefa.dataEntrega && <Entrega data={tarefa.dataEntrega} concluidaEm={tarefa.concluidaEm} />}
              {itens > 0 && <AnelChecklist feitos={itensFeitos} total={itens} />}
              {subtarefas && subtarefas.total > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[11.5px] text-neutral-500 tabular-nums"
                  title={`${subtarefas.concluidas} de ${subtarefas.total} subtarefas concluídas`}
                >
                  <ListTreeIcon className="size-3" strokeWidth={2.25} aria-hidden /> {subtarefas.concluidas}/{subtarefas.total}
                </span>
              )}
              {concluida && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-600">
                  <CheckCircle2Icon className="size-3" strokeWidth={2.25} aria-hidden /> Concluída
                </span>
              )}
            </span>
            {tarefa.responsaveis.length > 0 && <Avatares pessoas={tarefa.responsaveis.map((r) => r.usuario)} />}
          </div>
        </>
      )}
    </article>
  );
}
