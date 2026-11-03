"use client";

import { ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { TableCell, TableRow } from "@/componentes/ui/table";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirSituacaoTurmaAcao } from "../acoes/academico";
import { ROTULO_SITUACAO_TURMA, SITUACOES_TURMA, type SituacaoTurma } from "../esquemas/academico";

/** Linha de turma inteira clicável: abre a turma com a lista de alunos. */
export function LinhaTurma({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <TableRow
      className="hover:bg-muted/50 cursor-pointer"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      tabIndex={0}
      role="link"
    >
      {children}
      <TableCell className="text-muted-foreground w-0 pr-1">
        <ChevronRightIcon className="size-4" aria-hidden />
      </TableCell>
    </TableRow>
  );
}

/** Situação da turma trocada ali mesmo na lista, sem abrir a turma. */
export function SeletorSituacaoTurma({ id, situacao, rotulo }: { id: string; situacao: SituacaoTurma; rotulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <select
      aria-label={`Situação da ${rotulo}`}
      defaultValue={situacao}
      disabled={pendente}
      // A linha é clicável; o seletor não deve abrir a turma.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const nova = e.target.value;
        iniciar(async () => {
          if (avisar(await definirSituacaoTurmaAcao(id, nova))) router.refresh();
        });
      }}
      className="border-input bg-background h-8 rounded-md border px-2 text-xs"
    >
      {SITUACOES_TURMA.map((s) => (
        <option key={s} value={s}>
          {ROTULO_SITUACAO_TURMA[s]}
        </option>
      ))}
    </select>
  );
}
