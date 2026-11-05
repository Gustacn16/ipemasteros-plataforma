"use client";

import { useState, useTransition } from "react";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { mudarEtapaAcao } from "../acoes/conteudo";
import { ETAPAS_SELECIONAVEIS, ROTULO_ETAPA, type Etapa } from "../regras/etapas";

/** Muda a etapa do conteúdo. "Publicado" não é opção: vem das publicações nos canais. */
export function SeletorEtapa({ conteudoId, etapa, compacto }: { conteudoId: string; etapa: Etapa; compacto?: boolean }) {
  const [atual, setAtual] = useState(etapa);
  const [pendente, iniciar] = useTransition();

  if (etapa === "publicado") return null;

  return (
    <select
      aria-label="Etapa"
      value={atual}
      disabled={pendente}
      className={
        compacto
          ? "border-input bg-background focus-visible:ring-ring h-7 w-full min-w-0 rounded-md border px-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
          : "border-input bg-background focus-visible:ring-ring h-9 max-w-full rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
      }
      onChange={(e) => {
        const nova = e.target.value as Etapa;
        const anterior = atual;
        setAtual(nova);
        iniciar(async () => {
          if (!avisar(await mudarEtapaAcao(conteudoId, nova), `Movido para ${ROTULO_ETAPA[nova]}.`)) setAtual(anterior);
        });
      }}
    >
      {ETAPAS_SELECIONAVEIS.map((e) => (
        <option key={e} value={e}>
          {ROTULO_ETAPA[e]}
        </option>
      ))}
    </select>
  );
}
