import Link from "next/link";
import type { TarefaResumo } from "../servicos/tarefas";
import { SeloEtiqueta } from "./etiquetas";
import { Avatares, BadgePrioridade, DataEntrega, PontoCor } from "./exibicao";

type Status = { id: string; nome: string; cor: string; tipo: string };

type Props = {
  status: Status[];
  principais: TarefaResumo[];
  subtarefas: TarefaResumo[];
  urlTarefa: (id: string) => string;
};

function Linha({
  tarefa,
  href,
  sub,
}: {
  tarefa: TarefaResumo;
  href: string;
  sub?: boolean;
}) {
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
                : "block min-w-0 truncate font-medium hover:underline"
            }
          >
            {sub && <span aria-hidden>↳ </span>}
            {tarefa.titulo}
          </Link>
          {tarefa.etiquetas.slice(0, 2).map(({ etiqueta }) => (
            <SeloEtiqueta
              key={etiqueta.id}
              etiqueta={etiqueta}
              className="hidden max-w-28 shrink-0 sm:inline-flex"
            />
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <Avatares pessoas={tarefa.responsaveis.map((r) => r.usuario)} />
      </td>
      <td className="px-3 py-2 text-sm">
        <DataEntrega
          data={tarefa.dataEntrega}
          concluidaEm={tarefa.concluidaEm}
        />
      </td>
      <td className="px-3 py-2">
        <BadgePrioridade prioridade={tarefa.prioridade} />
      </td>
    </tr>
  );
}

/** Visualização Lista: tabela agrupada por status, subtarefas sob a tarefa principal. */
export function TabelaTarefas({
  status,
  principais,
  subtarefas,
  urlTarefa,
}: Props) {
  const subsPorPai = new Map<string, TarefaResumo[]>();
  for (const t of subtarefas)
    subsPorPai.set(t.tarefaPaiId!, [
      ...(subsPorPai.get(t.tarefaPaiId!) ?? []),
      t,
    ]);
  // Subtarefa cujo pai foi filtrado aparece sozinha no próprio status.
  const idsPrincipais = new Set(principais.map((t) => t.id));
  const orfas = subtarefas.filter((t) => !idsPrincipais.has(t.tarefaPaiId!));

  return (
    <div className="grid gap-6">
      {status.map((s) => {
        const doStatus = [...principais, ...orfas].filter(
          (t) => t.statusId === s.id,
        );
        return (
          <section key={s.id} aria-labelledby={`status-${s.id}`}>
            <h2
              id={`status-${s.id}`}
              className="mb-2 flex items-center gap-2 text-sm font-semibold"
            >
              <PontoCor cor={s.cor} />
              {s.nome}
              <span className="text-muted-foreground font-normal">
                {doStatus.length}
              </span>
            </h2>
            {doStatus.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm">
                Nenhuma tarefa.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[36rem] table-fixed text-left">
                  <colgroup>
                    <col />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col className="w-24" />
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
                    {doStatus.map((t) => (
                      <TarefaComSubs
                        key={t.id}
                        tarefa={t}
                        subs={subsPorPai.get(t.id) ?? []}
                        urlTarefa={urlTarefa}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TarefaComSubs({
  tarefa,
  subs,
  urlTarefa,
}: {
  tarefa: TarefaResumo;
  subs: TarefaResumo[];
  urlTarefa: (id: string) => string;
}) {
  return (
    <>
      <Linha
        tarefa={tarefa}
        href={urlTarefa(tarefa.id)}
        sub={Boolean(tarefa.tarefaPaiId)}
      />
      {!tarefa.tarefaPaiId &&
        subs.map((s) => (
          <Linha key={s.id} tarefa={s} href={urlTarefa(s.id)} sub />
        ))}
    </>
  );
}
