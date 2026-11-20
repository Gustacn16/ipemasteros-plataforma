"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Ponto = {
  rotulo: string;
  primeiraRespostaMin: number | null;
  respostaMin: number | null;
  noSlaPct: number | null;
  followupPct: number | null;
  nota: number | null;
};

type Chave = Exclude<keyof Ponto, "rotulo">;

const SERIES: { chave: Chave; nome: string; cor: string; eixo: "min" | "pct" | "nota"; unidade: string; tracejada?: boolean }[] = [
  { chave: "primeiraRespostaMin", nome: "1ª resposta", cor: "var(--chart-1)", eixo: "min", unidade: " min" },
  { chave: "respostaMin", nome: "Resposta", cor: "var(--chart-2)", eixo: "min", unidade: " min" },
  { chave: "noSlaPct", nome: "No SLA", cor: "var(--chart-3)", eixo: "pct", unidade: "%", tracejada: true },
  { chave: "followupPct", nome: "Follow-up", cor: "var(--chart-4)", eixo: "pct", unidade: "%", tracejada: true },
  { chave: "nota", nome: "Nota IA", cor: "var(--chart-5)", eixo: "nota", unidade: "" },
];

const EIXO = { fill: "var(--muted-foreground)", fontSize: 12 };

const valor = (v: number | null, unidade: string) => (v === null ? "—" : `${String(v).replace(".", ",")}${unidade}`);

type Serie = (typeof SERIES)[number];

function Dica({ active, payload, series }: { active?: boolean; payload?: { payload: Ponto }[]; series: Serie[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md tabular-nums">
      <p className="mb-1 font-medium">{p.rotulo}</p>
      {series.map((s) => (
        <p key={s.chave} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
          {s.nome}: <span className="font-medium">{valor(p[s.chave], s.unidade)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Evolução semanal de um número: tempos em minutos (eixo da esquerda) e percentuais (eixo da direita). Semana sem dado vira lacuna.
 * `comFollowup` falso (números fora dos times de venda) tira a série de follow-up.
 */
export function GraficoAtendimento({ dados, comFollowup }: { dados: Ponto[]; comFollowup: boolean }) {
  const series = comFollowup ? SERIES : SERIES.filter((s) => s.chave !== "followupPct");
  const resumo = dados
    .map((d) => `${d.rotulo}: ${series.map((s) => `${s.nome} ${valor(d[s.chave], s.unidade)}`).join(", ")}`)
    .join("; ");
  return (
    <div className="grid gap-3">
      <div className="h-64 w-full tabular-nums" role="img" aria-label={resumo || "Sem dados no período"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={EIXO} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis yAxisId="min" tick={EIXO} tickLine={false} axisLine={false} width={48} unit=" min" allowDecimals={false} />
            <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={EIXO} tickLine={false} axisLine={false} width={40} unit="%" />
            <YAxis yAxisId="nota" orientation="right" domain={[0, 10]} hide />
            <Tooltip content={<Dica series={series} />} cursor={{ stroke: "var(--border)" }} />
            {series.map((s) => (
              <Line
                key={s.chave}
                yAxisId={s.eixo}
                dataKey={s.chave}
                name={s.nome}
                stroke={s.cor}
                strokeWidth={2}
                strokeDasharray={s.tracejada ? "5 4" : undefined}
                dot={{ r: 3, fill: s.cor }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <li key={s.chave} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
            {s.nome} ({s.eixo === "min" ? "min" : s.eixo === "pct" ? "%" : "0 a 10"})
          </li>
        ))}
      </ul>
    </div>
  );
}
