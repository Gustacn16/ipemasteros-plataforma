"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { custoPorLead } from "../../../regras/midia";
import type { DadosMidia } from "../../../servicos/dashboard-midia";
import { cartao, mesCurto, reaisCompacto, textoApagado, tituloCartao } from "../estilos";

const ROXO = "#8b7bff";

type Ponto = { mes: string; investimento: number; leads: number };

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const cpl = custoPorLead(Math.round(p.investimento * 100), p.leads);
  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1e22] px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-medium capitalize">{mesCurto(p.mes)}</p>
      <p>Investimento: {formatarReais(p.investimento)}</p>
      <p>Leads: {p.leads}</p>
      <p className="text-white/70">Custo por lead: {cpl ? formatarReais(cpl) : "—"}</p>
    </div>
  );
}

/** Investimento (barras) e leads (linha) por mês, com 6M/12M. */
export function GraficoMidia({ serie }: { serie: DadosMidia["serie"] }) {
  const [meses, setMeses] = useState<6 | 12>(6);
  const pontos: Ponto[] = serie.slice(-meses).map((m) => ({ mes: m.mes, investimento: Number(m.investimento), leads: m.leads }));

  return (
    <section className={cn(cartao, "grid gap-4")} aria-label="Investimento e leads por mês">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={tituloCartao}>Investimento × Leads</h2>
        <div className="flex rounded-full bg-white/[0.06] p-1" role="group" aria-label="Período do gráfico">
          {([6, 12] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={meses === n}
              onClick={() => setMeses(n)}
              className={cn("rounded-full px-4 py-1.5 text-sm", meses === n ? "bg-white/15 text-white" : "text-white/60 hover:text-white")}
            >
              {n}M
            </button>
          ))}
        </div>
      </div>
      <div className={cn("flex gap-4 text-xs", textoApagado)}>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: ROXO }} /> Investimento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-white/70" /> Leads
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pontos} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tickFormatter={mesCurto}
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="r"
              tickFormatter={(v: number) => reaisCompacto(v)}
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={88}
            />
            <YAxis
              yAxisId="l"
              orientation="right"
              allowDecimals={false}
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<Dica />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <Bar yAxisId="r" dataKey="investimento" fill={ROXO} radius={[6, 6, 0, 0]} />
            <Line yAxisId="l" type="monotone" dataKey="leads" stroke="rgba(255,255,255,0.8)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
