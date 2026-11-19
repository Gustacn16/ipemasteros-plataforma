"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Ponto = { rotulo: string; medianaHoras: number | null; vendas: number };

const EIXO = { fill: "var(--muted-foreground)", fontSize: 12 };
const COR = "var(--chart-1)";

const horas = (v: number | null) => (v === null ? "—" : `${String(v).replace(".", ",")} h`);

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md tabular-nums">
      <p className="mb-1 font-medium">{p.rotulo}</p>
      <p className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: COR }} />
        Mediana: <span className="font-medium">{horas(p.medianaHoras)}</span>
      </p>
      <p className="text-muted-foreground">{p.vendas} {p.vendas === 1 ? "venda" : "vendas"} na semana</p>
    </div>
  );
}

/** Mediana semanal do tempo até o primeiro contato da CS, em horas. Semana sem contato vira lacuna. */
export function GraficoCs({ dados }: { dados: Ponto[] }) {
  const resumo = dados.map((d) => `${d.rotulo}: ${horas(d.medianaHoras)}`).join("; ");
  return (
    <div className="h-64 w-full tabular-nums" role="img" aria-label={resumo ? `Mediana até o primeiro contato. ${resumo}` : "Sem dados no período"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={EIXO} tickLine={false} axisLine={false} width={48} unit=" h" />
          <Tooltip content={<Dica />} cursor={{ stroke: "var(--border)" }} />
          <Line dataKey="medianaHoras" name="Mediana" stroke={COR} strokeWidth={2} dot={{ r: 3, fill: COR }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
