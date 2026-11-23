"use client";

import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { cn } from "@/lib/utils";
import { mudarStatusAcao } from "../acoes/tarefas";
import { ERRO_SUBTAREFAS_ABERTAS } from "../regras/status";
import type { TarefaResumo } from "../servicos/tarefas";
import { avisar } from "./avisar";
import { CartaoTarefa, type StatusQuadro } from "./cartao-tarefa";
import { PontoCor } from "./exibicao";
import { ID_MODELO } from "./modelo-url";

type Props = {
  status: StatusQuadro[];
  principais: TarefaResumo[];
  subtarefas: TarefaResumo[];
  modeloUrlTarefa: string;
};

/** Tipo próprio no arrastar, para a coluna ignorar links, textos ou arquivos soltos nela. */
const TIPO_ARRASTE = "application/x-ipemaster-tarefa";

/** Visualização Quadro: uma coluna por status; arrastar o cartão ou usar o menu dele move a tarefa. */
export function QuadroTarefas({ status, principais, subtarefas, modeloUrlTarefa }: Props) {
  // A mudança aparece na hora; se o servidor recusar, o cartão volta sozinho ao fim da transição.
  const [movidas, moverOtimista] = useOptimistic(new Map<string, string>(), (atual, [id, statusId]: [string, string]) =>
    new Map(atual).set(id, statusId),
  );
  const [, iniciar] = useTransition();
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);

  // Subtarefa cujo pai não está na tela (por filtro) aparece como cartão próprio.
  const idsPrincipais = new Set(principais.map((t) => t.id));
  const cartoes = [...principais, ...subtarefas.filter((t) => !idsPrincipais.has(t.tarefaPaiId!))];
  const progresso = new Map<string, { concluidas: number; total: number }>();
  for (const s of subtarefas) {
    const p = progresso.get(s.tarefaPaiId!) ?? { concluidas: 0, total: 0 };
    p.total++;
    if (s.concluidaEm) p.concluidas++;
    progresso.set(s.tarefaPaiId!, p);
  }

  function mover(tarefa: TarefaResumo, statusId: string) {
    const destino = status.find((s) => s.id === statusId);
    iniciar(async () => {
      moverOtimista([tarefa.id, statusId]);
      setPendentes((p) => new Set(p).add(tarefa.id));
      let r = await mudarStatusAcao({ tarefaId: tarefa.id, statusId });
      if (!r.ok && r.mensagem === ERRO_SUBTAREFAS_ABERTAS && window.confirm(ERRO_SUBTAREFAS_ABERTAS)) {
        r = await mudarStatusAcao({ tarefaId: tarefa.id, statusId, confirmarSubtarefasAbertas: true });
      }
      setPendentes((p) => {
        const n = new Set(p);
        n.delete(tarefa.id);
        return n;
      });
      if (r.ok || r.mensagem !== ERRO_SUBTAREFAS_ABERTAS) avisar(r, `Movida para ${destino?.nome ?? "outro status"}.`);
    });
  }

  const aceitaArraste = (e: DragEvent) => e.dataTransfer.types.includes(TIPO_ARRASTE);

  function soltar(e: DragEvent, statusId: string) {
    if (!aceitaArraste(e)) return;
    e.preventDefault();
    setColunaAlvo(null);
    setArrastando(null);
    const tarefa = cartoes.find((t) => t.id === e.dataTransfer.getData(TIPO_ARRASTE));
    if (tarefa && (movidas.get(tarefa.id) ?? tarefa.statusId) !== statusId) mover(tarefa, statusId);
  }

  return (
    <div className="relative -mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      <div className="flex snap-x snap-mandatory items-start gap-3 md:snap-none">
        {status.map((s) => {
          const daColuna = cartoes.filter((t) => (movidas.get(t.id) ?? t.statusId) === s.id);
          return (
            <section
              key={s.id}
              aria-labelledby={`coluna-${s.id}`}
              onDragOver={(e) => {
                if (!aceitaArraste(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (colunaAlvo !== s.id) setColunaAlvo(s.id);
              }}
              onDragLeave={(e) => {
                // Só sai da coluna de verdade, não ao passar por cima de um cartão dentro dela.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setColunaAlvo((c) => (c === s.id ? null : c));
              }}
              onDrop={(e) => soltar(e, s.id)}
              className={cn(
                "relative flex max-h-[calc(100svh-15rem)] w-[min(18rem,85vw)] shrink-0 snap-start flex-col rounded-2xl border border-border bg-muted/60 transition-colors",
                colunaAlvo === s.id && "border-primary bg-primary/5 ring-primary/30 ring-2",
              )}
            >
              <h2
                id={`coluna-${s.id}`}
                className="text-foreground flex min-w-0 items-center gap-2 px-4 pt-3.5 pb-1 text-[13px] font-medium tracking-[-0.005em]"
              >
                <PontoCor cor={s.cor} className="size-2" />
                <span className="min-w-0 truncate">{s.nome}</span>
                <ChipSituacao tom="neutro" tamanho="sm">
                  <span className="tabular-nums">{daColuna.length}</span>
                  <span className="sr-only"> {daColuna.length === 1 ? "tarefa" : "tarefas"}</span>
                </ChipSituacao>
              </h2>
              <div className="grid content-start gap-2 overflow-y-auto p-3 pt-2">
                {daColuna.length === 0 ? (
                  <p className="border-border bg-background/40 text-muted-foreground rounded-xl border border-dashed px-3 py-6 text-center text-xs">
                    Nenhuma tarefa
                  </p>
                ) : (
                  daColuna.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(TIPO_ARRASTE, t.id);
                        e.dataTransfer.effectAllowed = "move";
                        setArrastando(t.id);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setColunaAlvo(null);
                      }}
                      className={cn("cursor-grab active:cursor-grabbing", arrastando === t.id && "opacity-40")}
                    >
                      <CartaoTarefa
                        tarefa={{ ...t, statusId: movidas.get(t.id) ?? t.statusId }}
                        href={modeloUrlTarefa.replace(ID_MODELO, t.id)}
                        status={status}
                        subtarefas={t.tarefaPaiId ? undefined : progresso.get(t.id)}
                        pendente={pendentes.has(t.id)}
                        mover={(statusId) => mover(t, statusId)}
                      />
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
