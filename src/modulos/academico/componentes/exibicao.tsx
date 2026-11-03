import { notFound } from "next/navigation";
import { ErroNegocio } from "@/lib/erros";
import { cn } from "@/lib/utils";
import {
  ROTULO_SITUACAO_MATRICULA,
  ROTULO_SITUACAO_TURMA,
  SITUACOES_MATRICULA,
  SITUACOES_TURMA,
  UFS,
  type SituacaoMatricula,
  type SituacaoTurma,
} from "../esquemas/academico";

// Peças de exibição usadas pelas páginas de servidor (sem "use client").

const COR: Record<SituacaoMatricula | SituacaoTurma, string> = {
  ativa: "bg-emerald-100 text-emerald-800",
  em_andamento: "bg-emerald-100 text-emerald-800",
  planejada: "bg-sky-100 text-sky-800",
  trancada: "bg-amber-100 text-amber-800",
  concluida: "bg-neutral-100 text-neutral-700",
  cancelada: "bg-red-100 text-red-800",
};

export function SeloSituacao({ situacao, de }: { situacao: string; de: "turma" | "matricula" }) {
  const rotulo =
    de === "turma" ? ROTULO_SITUACAO_TURMA[situacao as SituacaoTurma] : ROTULO_SITUACAO_MATRICULA[situacao as SituacaoMatricula];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", COR[situacao as SituacaoTurma] ?? "bg-neutral-100")}>
      {rotulo ?? situacao}
    </span>
  );
}

/** "2026-03-01" → "01/03/2026". */
export const dataCurta = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export const OPCOES_SITUACAO_TURMA = SITUACOES_TURMA.map((s) => ({ valor: s, rotulo: ROTULO_SITUACAO_TURMA[s] }));
export const OPCOES_SITUACAO_MATRICULA = SITUACOES_MATRICULA.map((s) => ({ valor: s, rotulo: ROTULO_SITUACAO_MATRICULA[s] }));
export const OPCOES_UF = UFS.map((uf) => ({ valor: uf, rotulo: uf }));

/** Converte "não encontrado" do serviço em 404; outros erros seguem. */
export async function ou404<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
}
