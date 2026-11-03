"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Ponto = { rotulo: string; noPrazo: number; atrasadas: number; semData: number };

const SERIES = [
  { chave: "noPrazo", nome: "No prazo", cor: "var(--chart-1)" },
  { chave: "atrasadas", nome: "Com atraso", cor: "var(--perigo)" },
  { chave: "semData", nome: "Sem data", cor: "var(--muted-foreground)" },
] as const;

const EIXO = { fill: "var(--muted-foreground)", fontSize: 12 };

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md tabular-nums">
      <p className="mb-1 font-medium">{p.rotulo}</p>
      {SERIES.map((s) => (
        <p key={s.chave} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
          {s.nome}: <span className="font-medium">{p[s.chave]}</span>
        </p>
      ))}
    </div>
  );
}

/** Entregas por semana (ou mês) em colunas empilhadas: no prazo, com atraso e sem data. */
export function GraficoEntregas({ dados }: { dados: Ponto[] }) {
  const resumo = dados.map((d) => `${d.rotulo}: ${d.noPrazo} no prazo, ${d.atrasadas} com atraso, ${d.semData} sem data`).join("; ");
  return (
    <div className="grid gap-3">
      <div className="h-56 w-full tabular-nums" role="img" aria-label={resumo || "Sem entregas no período"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tick={EIXO} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<Dica />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.chave}
                dataKey={s.chave}
                name={s.nome}
                stackId="entregas"
                fill={s.cor}
                maxBarSize={40}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {SERIES.map((s) => (
          <li key={s.chave} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
            {s.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}
