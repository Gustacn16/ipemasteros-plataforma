"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Label } from "@/componentes/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/componentes/ui/select";
import { MODELOS_IA, ROTULO_MODELO, type ModeloIa } from "@/lib/ia/precos";
import { salvarConfiguracaoIa } from "../acoes/configuracao";

type Props = { modelo: ModeloIa; limiteMensalUsd: string; perguntasPorDia: number };

export function FormularioConfiguracao({ modelo, limiteMensalUsd, perguntasPorDia }: Props) {
  const [estado, executar, pendente] = useActionState(salvarConfiguracaoIa, { ok: false });
  return (
    <form action={executar} className="grid max-w-md gap-4">
      {estado.mensagem && (
        <Alert variant={estado.ok ? "default" : "destructive"}>
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="modelo">Modelo</Label>
        <Select name="modelo" defaultValue={modelo}>
          <SelectTrigger id="modelo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELOS_IA.map((m) => (
              <SelectItem key={m} value={m}>
                {ROTULO_MODELO[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {estado.erros?.modelo && <p className="text-destructive text-sm">{estado.erros.modelo.join(" ")}</p>}
      </div>
      <Campo
        rotulo="Limite mensal (US$)"
        name="limiteMensalUsd"
        inputMode="decimal"
        defaultValue={limiteMensalUsd}
        erros={estado.erros?.limiteMensalUsd}
        ajuda="Entre US$ 1 e US$ 1.000. Ao atingir, o Nexu para até o mês seguinte."
        required
      />
      <Campo
        rotulo="Perguntas por pessoa por dia"
        name="perguntasPorDia"
        type="number"
        min={1}
        max={500}
        defaultValue={perguntasPorDia}
        erros={estado.erros?.perguntasPorDia}
        required
      />
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
