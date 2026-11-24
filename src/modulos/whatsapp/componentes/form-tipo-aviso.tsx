"use client";

import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { salvarTipoParaAvisosAcao } from "../acoes/avisos-config";

export type TipoAvisoForm = { id: string; nome: string; divulgar: boolean; grupos: string[] };

/** Ajuste de um tipo de evento: divulgar nos grupos e quais grupos vêm marcados por padrão. */
export function FormTipoAviso({ tipo, grupos }: { tipo: TipoAvisoForm; grupos: { id: string; nome: string }[] }) {
  const [divulgar, setDivulgar] = useState(tipo.divulgar);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(() => new Set(tipo.grupos));
  const [pendente, executar] = useTransition();

  const alternar = (id: string, marcado: boolean) =>
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });

  return (
    <form
      className="grid gap-2 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        executar(async () => {
          avisar(await salvarTipoParaAvisosAcao({ tipoId: tipo.id, divulgar, grupos: [...escolhidos] }));
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={divulgar} onChange={(e) => setDivulgar(e.target.checked)} />
        {tipo.nome}: avisar nos grupos
      </label>
      {divulgar && (
        <fieldset className="grid gap-1">
          <legend className="text-muted-foreground mb-1 text-xs">Grupos marcados por padrão</legend>
          {grupos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum grupo monitorado.</p>
          ) : (
            <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
              {grupos.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={escolhidos.has(g.id)} onChange={(e) => alternar(g.id, e.target.checked)} />
                  {g.nome}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pendente}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
