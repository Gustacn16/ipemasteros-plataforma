import { notFound } from "next/navigation";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { ErroNegocio } from "@/lib/erros";
import {
  ROTULO_SITUACAO_MATRICULA,
  ROTULO_SITUACAO_TURMA,
  SITUACOES_MATRICULA,
  SITUACOES_TURMA,
  UFS,
} from "../esquemas/academico";
import { visualSituacao } from "./situacao-visual";

// Peças de exibição usadas pelas páginas de servidor (sem "use client").

export function SeloSituacao({ situacao, de }: { situacao: string; de: "turma" | "matricula" }) {
  const { tom, icone, rotulo } = visualSituacao(situacao, de);
  return (
    <ChipSituacao tom={tom} icone={icone} tamanho="sm">
      {rotulo}
    </ChipSituacao>
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
