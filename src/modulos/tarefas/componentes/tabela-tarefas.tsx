import Link from "next/link";
import type { ReactNode } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { cn } from "@/lib/utils";
import type { TarefaResumo } from "../servicos/tarefas";
import { ChipPrazo, ChipStatus } from "./chips-tarefa";
import { SeloEtiqueta } from "./etiquetas";
import { Avatares, ChipPrioridade, PontoCor } from "./exibicao";

type Status = { id: string; nome: string; cor: string; tipo: string };

type Props = {
  status: Status[];
  principais: TarefaResumo[];
  subtarefas: TarefaResumo[];
  urlTarefa: (id: string) => string;
  /** Mostrado no lugar dos grupos quando não há nenhuma tarefa na tela. */
  vazio?: ReactNode;
};

/** Tarefa seguida das subtarefas (só quando ela é principal). */
function comSubs(tarefa: TarefaResumo, subsPorPai: Map<string, TarefaResumo[]>) {
  return [
    { tarefa, sub: Boolean(tarefa.tarefaPaiId) },
    ...(tarefa.tarefaPaiId ? [] : (subsPorPai.get(tarefa.id) ?? []).map((s) => ({ tarefa: s, sub: true }))),
  ];
}

function Linha({ tarefa, href, sub }: { tarefa: TarefaResumo; href: string; sub?: boolean }) {
  return (
    <tr className="hover:bg-muted/50 border-t">
      <td className="max-w-0 py-2 pr-3 pl-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={href}
            scroll={false}
            className={
              sub
                ? "text-muted-foreground block min-w-0 truncate pl-6 text-sm hover:underline"
                : "text-foreground block min-w-0 truncate font-medium hover:underline"
            }
          >
            {sub && <span aria-hidden>↳ </span>}
            {tarefa.titulo}
          </Link>
          {tarefa.etiquetas.slice(0, 2).map(({ etiqueta }) => (
            <SeloEtiqueta key={etiqueta.id} etiqueta={etiqueta} className="hidden max-w-28 shrink-0 @4xl:inline-flex" />
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <Avatares pessoas={tarefa.responsaveis.map((r) => r.usuario)} />
      </td>
      <td className="px-3 py-2">
        <ChipPrazo dataEntrega={tarefa.dataEntrega} concluidaEm={tarefa.concluidaEm} />
      </td>
      <td className="px-3 py-2">
        <ChipPrioridade prioridade={tarefa.prioridade} />
      </td>
    </tr>
  );
}

/** Versão celular da linha: o cartão inteiro abre a tarefa pela mesma URL. */
function CartaoLinha({ tarefa, status, href, sub }: { tarefa: TarefaResumo; status: Status; href: string; sub?: boolean }) {
  return (
    <li
      className={cn(
        "bg-card text-card-foreground hover:bg-muted/50 relative min-w-0 rounded-xl border p-3 transition-colors",
        sub && "ml-4",
      )}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "line-clamp-2 block text-sm leading-snug outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring",
          sub ? "text-muted-foreground" : "text-foreground font-medium",
          tarefa.concluidaEm && "line-through",
        )}
      >
        {sub && <span aria-hidden>↳ </span>}
        {tarefa.titulo}
      </Link>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <ChipStatus nome={status.nome} cor={status.cor} />
          <ChipPrazo dataEntrega={tarefa.dataEntrega} concluidaEm={tarefa.concluidaEm} />
          <ChipPrioridade prioridade={tarefa.prioridade} />
        </div>
        {tarefa.responsaveis.length > 0 && <Avatares pessoas={tarefa.responsaveis.map((r) => r.usuario)} />}
      </div>
    </li>
  );
}

/** Visualização Lista: agrupada por status, subtarefas sob a tarefa principal. Tabela quando a área tem ≥ 42rem; cartões abaixo disso (celular incluso). */
export function TabelaTarefas({ status, principais, subtarefas, urlTarefa, vazio }: Props) {
  const subsPorPai = new Map<string, TarefaResumo[]>();
  for (const t of subtarefas) subsPorPai.set(t.tarefaPaiId!, [...(subsPorPai.get(t.tarefaPaiId!) ?? []), t]);
  // Subtarefa cujo pai foi filtrado aparece sozinha no próprio status.
  const idsPrincipais = new Set(principais.map((t) => t.id));
  const orfas = subtarefas.filter((t) => !idsPrincipais.has(t.tarefaPaiId!));

  if (vazio && principais.length === 0 && subtarefas.length === 0) return <>{vazio}</>;

  return (
    // Container query: com os dois menus abertos a área útil fica estreita mesmo acima de md.
    <div className="@container grid min-w-0 grid-cols-1 gap-6">
      {status.map((s) => {
        const doStatus = [...principais, ...orfas].filter((t) => t.statusId === s.id);
        const linhas = doStatus.flatMap((t) => comSubs(t, subsPorPai));
        return (
          <section key={s.id} aria-labelledby={`status-${s.id}`} className="min-w-0">
            <h2 id={`status-${s.id}`} className="text-foreground mb-2 flex min-w-0 items-center gap-2 text-sm font-semibold">
              <PontoCor cor={s.cor} />
              <span className="min-w-0 truncate">{s.nome}</span>
              <ChipSituacao tom="neutro" tamanho="sm">
                <span className="tabular-nums">{doStatus.length}</span>
                <span className="sr-only"> {doStatus.length === 1 ? "tarefa" : "tarefas"}</span>
              </ChipSituacao>
            </h2>
            {doStatus.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm">Nenhuma tarefa.</p>
            ) : (
              <>
                <ul className="grid min-w-0 grid-cols-1 gap-2 @2xl:hidden">
                  {linhas.map(({ tarefa, sub }) => (
                    <CartaoLinha key={tarefa.id} tarefa={tarefa} status={s} href={urlTarefa(tarefa.id)} sub={sub} />
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-md border @2xl:block">
                  <table className="hidden w-full min-w-[40rem] table-fixed text-left @2xl:table">
                    <colgroup>
                      <col />
                      <col className="w-28" />
                      <col className="w-40" />
                      <col className="w-32" />
                    </colgroup>
                    <thead className="text-muted-foreground bg-muted/40 text-xs">
                      <tr>
                        <th className="px-3 py-2 font-medium">Tarefa</th>
                        <th className="px-3 py-2 font-medium">Responsáveis</th>
                        <th className="px-3 py-2 font-medium">Entrega</th>
                        <th className="px-3 py-2 font-medium">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(({ tarefa, sub }) => (
                        <Linha key={tarefa.id} tarefa={tarefa} href={urlTarefa(tarefa.id)} sub={sub} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
