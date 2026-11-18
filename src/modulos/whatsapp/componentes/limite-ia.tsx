"use client";

import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { salvarLimiteIaWhatsappAcao } from "../acoes/numeros";

export function LimiteIa({ limiteUsd }: { limiteUsd: number }) {
  const [valor, setValor] = useState(String(limiteUsd).replace(".", ","));
  const [pendente, executar] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const numero = Number(valor.replace(",", "."));
        executar(async () => {
          avisar(await salvarLimiteIaWhatsappAcao({ limiteUsd: numero }));
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        Limite mensal (US$)
        <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="w-32" />
      </label>
      <Button type="submit" size="sm" disabled={pendente}>
        Salvar limite
      </Button>
    </form>
  );
}
