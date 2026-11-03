"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { resumoSerie } from "../../regras/dashboard";
import type { DadosDashboard } from "../../servicos/dashboard";
import { cartao, mesCurto, reaisCompacto, textoApagado, tituloCartao } from "./estilos";

const ROXO = "#8b7bff";

type Ponto = { mes: string; vendido: number; meta: number };

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1e22] px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-medium capitalize">{mesCurto(p.mes)}</p>
      <p>Vendido: {formatarReais(p.vendido)}</p>
      <p className="text-white/70">Meta: {p.meta > 0 ? formatarReais(p.meta) : "—"}</p>
    </div>
  );
}

/** Vendido × Meta por mês, com a meta tracejada e a alternância 6M/12M. */
export function GraficoVendas({ serie }: { serie: DadosDashboard["serie"] }) {
  const [meses, setMeses] = useState<6 | 12>(6);
  const janela = serie.slice(-meses);
  const resumo = resumoSerie(janela);
  const pontos: Ponto[] = janela.map((m) => ({ mes: m.mes, vendido: Number(m.vendido), meta: Number(m.meta) }));
  const temMeta = pontos.some((p) => p.meta > 0);

  return (
    <section className={cn(cartao, "grid gap-4")} aria-label="Vendido e meta por mês">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={tituloCartao}>Vendido × Meta</h2>
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
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-semibold tracking-tight text-white">{formatarReais(resumo.total)}</span>
        <span className={textoApagado}>
          em {meses} meses{resumo.comMeta > 0 && ` · ${resumo.bateram} de ${resumo.comMeta} bateram a meta`}
        </span>
      </p>
      <div className="flex gap-4 text-xs text-white/70">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: ROXO }} /> Vendido
        </span>
        {temMeta && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-white/60" /> Meta
          </span>
        )}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pontos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="vendido-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ROXO} stopOpacity={0.35} />
                <stop offset="100%" stopColor={ROXO} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="mes"
              tickFormatter={mesCurto}
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => reaisCompacto(v)}
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={88}
            />
            <Tooltip content={<Dica />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
            <Area type="monotone" dataKey="vendido" stroke={ROXO} strokeWidth={2.5} fill="url(#vendido-area)" />
            {temMeta && (
              <Line type="monotone" dataKey="meta" stroke="rgba(255,255,255,0.6)" strokeDasharray="6 6" strokeWidth={2} dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
