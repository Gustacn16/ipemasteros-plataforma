import { CalendarCheck, CalendarClock, CalendarX, CircleCheck } from "lucide-react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { rotuloChipPrazo, situacaoEntrega } from "@/modulos/tarefas/regras/prazo";
import type { Etapa } from "../regras/etapas";

/** Chip da data de publicação prevista: atrasado, hoje, amanhã, em N dias ou a data. `agora` fixa a data em prévias. */
export function ChipPublicacao({
  dataPublicacao,
  etapa,
  agora = new Date(),
  tamanho = "sm",
}: {
  dataPublicacao: Date | null;
  etapa: Etapa;
  agora?: Date;
  tamanho?: "sm" | "md";
}) {
  if (!dataPublicacao) return null;
  const situacao = situacaoEntrega(dataPublicacao, etapa === "publicado" ? dataPublicacao : null, agora);
  const base = rotuloChipPrazo(situacao, dataPublicacao);
  // Cancelado não atrasa: mostra só a data.
  if (etapa === "cancelado") {
    const data = rotuloChipPrazo({ tom: "futura", dias: 0 }, dataPublicacao).texto;
    return (
      <ChipSituacao icone={CalendarCheck} tamanho={tamanho}>
        <span className="sr-only">Publicação prevista: </span>
        {data}
      </ChipSituacao>
    );
  }
  const n = Math.abs(situacao.dias);
  const texto =
    situacao.tom === "concluida"
      ? "Publicado"
      : situacao.tom === "atrasada"
        ? `Atrasado ${n} ${n === 1 ? "dia" : "dias"}`
        : situacao.tom === "hoje"
          ? "Publica hoje"
          : situacao.tom === "amanha"
            ? "Publica amanhã"
            : base.texto;
  const icone =
    situacao.tom === "concluida"
      ? CircleCheck
      : situacao.tom === "atrasada"
        ? CalendarX
        : situacao.tom === "hoje" || situacao.tom === "amanha"
          ? CalendarClock
          : CalendarCheck;
  return (
    <ChipSituacao tom={base.tom} icone={icone} tamanho={tamanho}>
      <span className="sr-only">Publicação prevista: </span>
      {texto}
    </ChipSituacao>
  );
}
