import { CalendarCheck, CalendarClock, CalendarX, CircleCheck } from "lucide-react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { rotuloChipPrazo, situacaoEntrega } from "../regras/prazo";

/** Chip do prazo da tarefa (textos e tons da spec). `agora` existe para fixar a data em testes e prévias. */
export function ChipPrazo({
  dataEntrega,
  concluidaEm = null,
  agora = new Date(),
  tamanho = "sm",
}: {
  dataEntrega: Date | null;
  concluidaEm?: Date | null;
  agora?: Date;
  tamanho?: "sm" | "md";
}) {
  if (!dataEntrega) {
    return (
      <span className="text-muted-foreground text-xs" aria-label="Sem data de entrega">
        —
      </span>
    );
  }
  const situacao = situacaoEntrega(dataEntrega, concluidaEm, agora);
  const { texto, tom } = rotuloChipPrazo(situacao, dataEntrega);
  const icone =
    situacao.tom === "concluida" ? CircleCheck : situacao.tom === "atrasada" ? CalendarX : situacao.tom === "hoje" || situacao.tom === "amanha" ? CalendarClock : CalendarCheck;
  return (
    <ChipSituacao tom={tom} icone={icone} tamanho={tamanho}>
      {texto}
    </ChipSituacao>
  );
}

/** Chip do status da tarefa, na cor cadastrada na lista. */
export function ChipStatus({ nome, cor, tamanho = "sm" }: { nome: string; cor: string; tamanho?: "sm" | "md" }) {
  return (
    <ChipSituacao cor={cor} tamanho={tamanho}>
      {nome}
    </ChipSituacao>
  );
}
