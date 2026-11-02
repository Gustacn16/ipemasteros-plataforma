"use client";

import { useOptimistic, useState, useTransition } from "react";
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

/** Visualização Quadro: uma coluna por status; o menu de cada cartão move a tarefa. */
export function QuadroTarefas({ status, principais, subtarefas, modeloUrlTarefa }: Props) {
  // A mudança aparece na hora; se o servidor recusar, o cartão volta sozinho ao fim da transição.
  const [movidas, moverOtimista] = useOptimistic(new Map<string, string>(), (atual, [id, statusId]: [string, string]) =>
    new Map(atual).set(id, statusId),
  );
  const [, iniciar] = useTransition();
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());

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

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      <div className="flex snap-x snap-mandatory items-start gap-3 md:snap-none">
        {status.map((s) => {
          const daColuna = cartoes.filter((t) => (movidas.get(t.id) ?? t.statusId) === s.id);
          return (
            <section
              key={s.id}
              aria-labelledby={`coluna-${s.id}`}
              className="bg-muted/50 flex max-h-[calc(100svh-15rem)] w-[min(18rem,85vw)] shrink-0 snap-start flex-col rounded-xl"
            >
              <h2 id={`coluna-${s.id}`} className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm font-semibold">
                <PontoCor cor={s.cor} />
                <span className="truncate">{s.nome}</span>
                <span className="bg-background text-muted-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-medium">{daColuna.length}</span>
              </h2>
              <div className="grid content-start gap-2 overflow-y-auto px-2 pb-2">
                {daColuna.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">Nenhuma tarefa</p>
                ) : (
                  daColuna.map((t) => (
                    <CartaoTarefa
                      key={t.id}
                      tarefa={{ ...t, statusId: movidas.get(t.id) ?? t.statusId }}
                      href={modeloUrlTarefa.replace(ID_MODELO, t.id)}
                      status={status}
                      subtarefas={t.tarefaPaiId ? undefined : progresso.get(t.id)}
                      pendente={pendentes.has(t.id)}
                      mover={(statusId) => mover(t, statusId)}
                    />
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
