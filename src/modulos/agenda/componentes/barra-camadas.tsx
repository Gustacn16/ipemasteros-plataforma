"use client";

import { CheckSquareIcon, LayersIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { gravarCookie } from "@/lib/cookie-navegador";
import { cn } from "@/lib/utils";
import { COOKIE_FILTRO, type FiltroAgenda } from "../esquemas/agenda";

const COR_TAREFA = "#5F45F4";

/** Salva camadas e visão no cookie e recarrega a tela. `null` limpa tudo. */
export function useAplicarFiltroAgenda() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const aplicar = (filtro: FiltroAgenda | null, depois?: () => void) => {
    gravarCookie(COOKIE_FILTRO, filtro ? JSON.stringify(filtro) : null, "/agenda");
    iniciar(() => (depois ? depois() : router.refresh()));
  };
  return { aplicar, pendente };
}

type Tipo = { id: string; nome: string; cor: string };
type Props = {
  filtro: FiltroAgenda;
  tipos: Tipo[];
  /** Agendas pessoais da pessoa; cada uma liga e desliga em `filtro.desligadas`. */
  agendas?: Tipo[];
  turmas: string[];
  mostrarInstitucional: boolean;
  mostrarTarefas: boolean;
};

const chip =
  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

/** Camadas da agenda: tipos de evento da IPEMaster, turma, Minhas tarefas e as agendas pessoais. Ficam salvas até Limpar. */
export function BarraCamadas({ filtro, tipos, agendas = [], turmas, mostrarInstitucional, mostrarTarefas }: Props) {
  const { aplicar, pendente } = useAplicarFiltroAgenda();
  const ids = tipos.map((t) => t.id);
  const ligado = (id: string) => filtro.tipos.length === 0 || filtro.tipos.includes(id);
  const ligados = ids.filter(ligado);
  const idsAgendas = new Set(agendas.map((a) => a.id));
  // Só contam as desligadas que ainda existem (uma agenda removida pode ter ficado no cookie).
  const desligadas = filtro.desligadas.filter((id) => idsAgendas.has(id));
  const total = (filtro.tipos.length > 0 ? 1 : 0) + (filtro.turma ? 1 : 0) + (filtro.tarefas ? 0 : 1) + desligadas.length;

  function alternarAgenda(id: string) {
    const novas = desligadas.includes(id) ? desligadas.filter((a) => a !== id) : [...desligadas, id];
    aplicar({ ...filtro, desligadas: novas });
  }

  function alternarTipo(id: string) {
    const novos = ligado(id) ? ligados.filter((t) => t !== id) : [...ligados, id];
    if (novos.length === 0) return; // ao menos um tipo fica ligado
    aplicar({ ...filtro, tipos: novos.length === ids.length ? [] : novos });
  }

  return (
    <div role="group" aria-label="Camadas" className={cn("flex flex-wrap items-center gap-2", pendente && "opacity-60")}>
      <LayersIcon className="text-muted-foreground size-4" aria-hidden />
      {mostrarInstitucional && (
        <>
          <span className="text-muted-foreground text-xs font-medium">IPEMaster</span>
          {tipos.map((t) => {
            const on = ligado(t.id);
            const unico = on && ligados.length === 1;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                disabled={pendente || unico}
                title={unico ? "Deixe ao menos um tipo ligado" : undefined}
                onClick={() => alternarTipo(t.id)}
                className={cn(chip, on ? "bg-background" : "text-muted-foreground border-dashed opacity-70 hover:opacity-100", unico && "cursor-default")}
                style={on ? { borderColor: `color-mix(in oklab, ${t.cor} 55%, var(--border))` } : undefined}
              >
                <span className="size-2.5 rounded-full" style={on ? { backgroundColor: t.cor } : { boxShadow: `inset 0 0 0 1.5px ${t.cor}` }} aria-hidden />
                {t.nome}
              </button>
            );
          })}
          {turmas.length > 0 && (
            <select
              aria-label="Turma"
              className={cn(
                "border-input bg-background h-7 max-w-44 rounded-full border px-2.5 text-xs",
                filtro.turma && "border-[#5F45F4] font-medium",
              )}
              value={filtro.turma ?? ""}
              disabled={pendente}
              onChange={(e) => aplicar({ ...filtro, turma: e.target.value || undefined })}
            >
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      {mostrarTarefas && (
        <button
          type="button"
          aria-pressed={filtro.tarefas}
          disabled={pendente}
          onClick={() => aplicar({ ...filtro, tarefas: !filtro.tarefas })}
          className={cn(chip, filtro.tarefas ? "bg-background" : "text-muted-foreground border-dashed opacity-70 hover:opacity-100")}
          style={filtro.tarefas ? { borderColor: `color-mix(in oklab, ${COR_TAREFA} 55%, var(--border))` } : undefined}
        >
          <CheckSquareIcon className="size-3.5" style={{ color: COR_TAREFA }} aria-hidden />
          Minhas tarefas
        </button>
      )}
      {agendas.length > 0 && (
        <>
          <span className="text-muted-foreground text-xs font-medium">Minhas agendas</span>
          {agendas.map((a) => {
            const on = !desligadas.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                disabled={pendente}
                onClick={() => alternarAgenda(a.id)}
                className={cn(chip, "border-dashed", on ? "bg-background" : "text-muted-foreground opacity-70 hover:opacity-100")}
                style={on ? { borderColor: `color-mix(in oklab, ${a.cor} 55%, var(--border))` } : undefined}
              >
                <span className="size-2.5 rounded-full" style={on ? { backgroundColor: a.cor } : { boxShadow: `inset 0 0 0 1.5px ${a.cor}` }} aria-hidden />
                {a.nome}
              </button>
            );
          })}
        </>
      )}
      {total > 0 && (
        <Button size="sm" variant="ghost" onClick={() => aplicar(null)} disabled={pendente}>
          <XIcon /> Limpar filtros ({total})
        </Button>
      )}
    </div>
  );
}
