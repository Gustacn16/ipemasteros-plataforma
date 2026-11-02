"use client";

import { CheckIcon } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { mudarStatusAcao } from "../acoes/tarefas";
import { ERRO_SUBTAREFAS_ABERTAS } from "../regras/status";
import { avisar } from "./avisar";

/** Conclui a tarefa direto da lista "Minhas tarefas" (usado por quem não abre a lista). */
export function BotaoConcluir({ tarefaId, statusId }: { tarefaId: string; statusId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          let r = await mudarStatusAcao({ tarefaId, statusId });
          if (!r.ok && r.mensagem === ERRO_SUBTAREFAS_ABERTAS) {
            if (!window.confirm(ERRO_SUBTAREFAS_ABERTAS)) return;
            r = await mudarStatusAcao({ tarefaId, statusId, confirmarSubtarefasAbertas: true });
          }
          avisar(r, "Tarefa concluída.");
        })
      }
    >
      <CheckIcon /> Concluir
    </Button>
  );
}
