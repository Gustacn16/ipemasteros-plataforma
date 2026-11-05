"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarReais } from "@/lib/dinheiro";

type Ponto = { nome: string; vendido: number; meta: number };

const compacto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{p.nome}</p>
      <p>Vendido: {formatarReais(p.vendido)}</p>
      <p className="text-muted-foreground">Meta: {p.meta > 0 ? formatarReais(p.meta) : "—"}</p>
    </div>
  );
}

/** Vendido × meta de cada vendedor no mês. */
export function GraficoMetas({ pontos }: { pontos: Ponto[] }) {
  const altura = Math.max(200, pontos.length * 56);
  return (
    <div className="w-full" style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pontos} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => compacto.format(v).replace(/ /g, " ")}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={110}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<Dica />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="meta" name="Meta" fill="var(--muted-foreground)" fillOpacity={0.35} radius={[0, 4, 4, 0]} barSize={14} />
          <Bar dataKey="vendido" name="Vendido" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
