"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { salvarRegrasAtendimentoAcao } from "../acoes/numeros";
import type { RegrasAtendimento } from "../esquemas/regras-atendimento";
import { DIAS_DA_SEMANA, horaParaMinutos, minutosParaHora } from "../regras/horario";

type Dia = { aberto: boolean; inicio: string; fim: string };

/** Formulário do admin: horário de cada dia, SLA e follow-up. Converte HH:MM em minutos; o servidor valida o resto. */
export function RegrasAtendimentoForm({ regras }: { regras: RegrasAtendimento }) {
  const [dias, setDias] = useState<Dia[]>(() =>
    regras.horario.map((f) => (f ? { aberto: true, inicio: minutosParaHora(f.inicioMin), fim: minutosParaHora(f.fimMin) } : { aberto: false, inicio: "08:00", fim: "18:00" })),
  );
  const [sla, setSla] = useState(String(regras.slaMinutos));
  const [horas, setHoras] = useState(String(regras.followupHoras));
  const [prazo, setPrazo] = useState(String(regras.followupDias));
  const [pendente, executar] = useTransition();

  const mudarDia = (i: number, parte: Partial<Dia>) => setDias((atual) => atual.map((d, j) => (j === i ? { ...d, ...parte } : d)));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const horario: RegrasAtendimento["horario"] = [];
    for (const [i, d] of dias.entries()) {
      if (!d.aberto) {
        horario.push(null);
        continue;
      }
      const inicioMin = horaParaMinutos(d.inicio);
      const fimMin = horaParaMinutos(d.fim);
      if (inicioMin === null || fimMin === null) {
        toast.error(`Informe o horário de ${DIAS_DA_SEMANA[i]} no formato HH:MM.`);
        return;
      }
      horario.push({ inicioMin, fimMin });
    }
    const dados = { horario, slaMinutos: Number(sla), followupHoras: Number(horas), followupDias: Number(prazo) };
    executar(async () => {
      avisar(await salvarRegrasAtendimentoAcao(dados));
    });
  }

  return (
    <form className="grid gap-4" onSubmit={enviar}>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Horário de atendimento</legend>
        {dias.map((d, i) => (
          <div key={DIAS_DA_SEMANA[i]} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex w-28 items-center gap-2">
              <input type="checkbox" checked={d.aberto} onChange={(e) => mudarDia(i, { aberto: e.target.checked })} />
              {DIAS_DA_SEMANA[i]}
            </label>
            {d.aberto ? (
              <>
                <Input
                  type="time"
                  aria-label={`Início de ${DIAS_DA_SEMANA[i]}`}
                  value={d.inicio}
                  onChange={(e) => mudarDia(i, { inicio: e.target.value })}
                  className="w-28"
                />
                <span className="text-muted-foreground">às</span>
                <Input
                  type="time"
                  aria-label={`Fim de ${DIAS_DA_SEMANA[i]}`}
                  value={d.fim}
                  onChange={(e) => mudarDia(i, { fim: e.target.value })}
                  className="w-28"
                />
              </>
            ) : (
              <span className="text-muted-foreground">Fechado</span>
            )}
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="grid gap-1 text-sm">
          Prazo de resposta (min)
          <Input type="number" inputMode="numeric" min={1} max={240} value={sla} onChange={(e) => setSla(e.target.value)} className="w-32" />
        </label>
        <label className="grid gap-1 text-sm">
          Follow-up devido após (h)
          <Input type="number" inputMode="numeric" min={1} max={168} value={horas} onChange={(e) => setHoras(e.target.value)} className="w-32" />
        </label>
        <label className="grid gap-1 text-sm">
          Prazo do follow-up (dias)
          <Input type="number" inputMode="numeric" min={1} max={14} value={prazo} onChange={(e) => setPrazo(e.target.value)} className="w-32" />
        </label>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pendente}>
          Salvar regras
        </Button>
      </div>
    </form>
  );
}
