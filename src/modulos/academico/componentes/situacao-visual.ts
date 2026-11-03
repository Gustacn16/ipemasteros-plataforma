import { BanIcon, CircleCheckIcon, CircleDotIcon, CirclePauseIcon, FlagIcon, type LucideIcon } from "lucide-react";
import type { Tom } from "@/componentes/regras-visuais";
import { ROTULO_SITUACAO_MATRICULA, ROTULO_SITUACAO_TURMA, type SituacaoMatricula, type SituacaoTurma } from "../esquemas/academico";

// Tom, ícone e rótulo de cada situação, iguais em todas as telas do módulo.

type Visual = { tom: Tom; icone: LucideIcon };

const VISUAL: Record<SituacaoMatricula | SituacaoTurma, Visual> = {
  ativa: { tom: "sucesso", icone: CircleCheckIcon },
  em_andamento: { tom: "sucesso", icone: CircleDotIcon },
  planejada: { tom: "informacao", icone: CircleDotIcon },
  trancada: { tom: "atencao", icone: CirclePauseIcon },
  concluida: { tom: "neutro", icone: FlagIcon },
  cancelada: { tom: "perigo", icone: BanIcon },
};

export function visualSituacao(situacao: string, de: "turma" | "matricula") {
  const visual = VISUAL[situacao as SituacaoTurma] ?? { tom: "neutro" as Tom, icone: CircleDotIcon };
  const rotulo =
    (de === "turma" ? ROTULO_SITUACAO_TURMA[situacao as SituacaoTurma] : ROTULO_SITUACAO_MATRICULA[situacao as SituacaoMatricula]) ?? situacao;
  return { ...visual, rotulo };
}
