"use client";

import { GoalIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { criarPlanoAcao } from "../acoes/planejamento";

/** Ano sem plano: quem edita pode criar; os outros só veem o aviso. */
export function SemPlano({ ano, editor }: { ano: number; editor: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <EstadoVazio
      icone={GoalIcon}
      titulo={`Ainda não há plano para ${ano}`}
      descricao={
        editor
          ? "O plano já nasce com as premissas do funil e os indicadores de Comercial e Marketing da planilha. Depois é só cadastrar as turmas."
          : "Peça para a gestão criar o plano do ano."
      }
      acao={
        editor ? (
          <Button
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                if (avisar(await criarPlanoAcao(ano))) router.refresh();
              })
            }
          >
            <PlusIcon /> {pendente ? "Criando…" : `Criar plano de ${ano}`}
          </Button>
        ) : undefined
      }
    />
  );
}
