"use client";

import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { confirmarPropostaAcao, recusarPropostaAcao } from "../acoes/propostas";
import type { PropostaVisivel } from "../tipos";

/** Cartão de uma proposta do Nexu: resumo + Confirmar/Recusar; depois mostra o resultado. Nada é criado sem o clique. */
export function CartaoProposta({ proposta, aoAtualizar }: { proposta: PropostaVisivel; aoAtualizar?: (p: PropostaVisivel) => void }) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  function decidir(acao: typeof confirmarPropostaAcao) {
    setAviso(null);
    iniciar(async () => {
      const r = await acao(proposta.id);
      if (r.ok && r.dados) aoAtualizar?.(r.dados);
      else setAviso(r.mensagem ?? "Não foi possível concluir. Tente de novo.");
    });
  }

  return (
    <div aria-live="polite" className="border-border bg-card text-card-foreground max-w-[85%] rounded-xl border px-3 py-2 text-sm">
      <p className="break-words">{proposta.resumo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {proposta.status === "pendente" && (
          <>
            <Button size="sm" disabled={pendente} onClick={() => decidir(confirmarPropostaAcao)}>
              Confirmar
            </Button>
            <Button size="sm" variant="outline" disabled={pendente} onClick={() => decidir(recusarPropostaAcao)}>
              Recusar
            </Button>
          </>
        )}
        {proposta.status === "executando" && <span className="text-muted-foreground">Em andamento…</span>}
        {proposta.status === "confirmada" && (
          <span className="text-foreground font-medium">
            ✓ Criada
            {proposta.resultadoUrl && (
              <>
                {" · "}
                <a href={proposta.resultadoUrl} className="text-primary underline underline-offset-2">
                  abrir
                </a>
              </>
            )}
          </span>
        )}
        {proposta.status === "recusada" && <span className="text-muted-foreground">Recusada</span>}
        {proposta.status === "falhou" && <span className="text-destructive">{proposta.erro ?? "A proposta falhou."}</span>}
      </div>
      {aviso && (
        <p role="alert" className="text-destructive mt-2">
          {aviso}
        </p>
      )}
    </div>
  );
}
