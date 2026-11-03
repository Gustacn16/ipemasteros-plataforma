"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { TableCell, TableRow } from "@/componentes/ui/table";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirSituacaoTurmaAcao } from "../acoes/academico";
import { ROTULO_SITUACAO_TURMA, SITUACOES_TURMA, type SituacaoTurma } from "../esquemas/academico";
import { visualSituacao } from "./situacao-visual";

/** Abre a turma ao clicar ou apertar Enter; usado na linha da tabela e no cartão do celular. */
function useAbrir(href: string) {
  const router = useRouter();
  return {
    onClick: () => router.push(href),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") router.push(href);
    },
    tabIndex: 0,
    role: "link" as const,
  };
}

/** Linha de turma inteira clicável: abre a turma com a lista de alunos. */
export function LinhaTurma({ href, children }: { href: string; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-muted/50 cursor-pointer" {...useAbrir(href)}>
      {children}
      <TableCell className="text-muted-foreground w-0 pr-1">
        <ChevronRightIcon className="size-4" aria-hidden />
      </TableCell>
    </TableRow>
  );
}

/** A mesma turma como cartão, para telas estreitas. */
export function CartaoTurma({ href, nome, situacao, children }: { href: string; nome: string; situacao: ReactNode; children: ReactNode }) {
  return (
    <li className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3" {...useAbrir(href)}>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <span className="font-medium">{nome}</span>
        <div>{situacao}</div>
        <div className="text-muted-foreground text-xs tabular-nums">{children}</div>
      </div>
      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </li>
  );
}

/**
 * Situação da turma como chip; ao tocar, vira um seletor e salva na hora.
 * Não abre a turma (a linha em volta é clicável).
 */
export function SeletorSituacaoTurma({ id, situacao, rotulo }: { id: string; situacao: SituacaoTurma; rotulo: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  const { tom, icone, rotulo: texto } = visualSituacao(situacao, "turma");

  if (!editando) {
    return (
      <button
        type="button"
        onClick={(e) => {
          parar(e);
          setEditando(true);
        }}
        onKeyDown={parar}
        aria-label={`Situação da ${rotulo}: ${texto}. Alterar`}
        className="focus-visible:ring-ring inline-flex items-center gap-0.5 rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChipSituacao tom={tom} icone={icone} tamanho="sm">
          {texto}
        </ChipSituacao>
        <ChevronDownIcon className="text-muted-foreground size-3.5" aria-hidden />
      </button>
    );
  }

  return (
    <select
      aria-label={`Situação da ${rotulo}`}
      autoFocus
      defaultValue={situacao}
      disabled={pendente}
      onClick={parar}
      onKeyDown={(e) => {
        parar(e);
        if (e.key === "Escape") setEditando(false);
      }}
      onBlur={() => !pendente && setEditando(false)}
      onChange={(e) => {
        const nova = e.target.value;
        iniciar(async () => {
          if (avisar(await definirSituacaoTurmaAcao(id, nova))) router.refresh();
          setEditando(false);
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
