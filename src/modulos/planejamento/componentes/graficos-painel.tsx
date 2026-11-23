"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rotuloMesCurto } from "./formatar";

type Ponto = { mes: string; meta: number; realizado: number | null };

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Barras meta × realizado, mês a mês. */
export function GraficoMetaRealizado({ titulo, dados, reais = false, rotuloMeta = "Meta" }: { titulo: string; dados: Ponto[]; reais?: boolean; rotuloMeta?: string }) {
  const formatar = (v: number) => (reais ? `R$ ${compacto.format(v)}` : compacto.format(v));
  return (
    <section className="bg-card grid gap-2 rounded-xl border p-4">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados.map((d) => ({ ...d, rotulo: rotuloMesCurto(d.mes) }))} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.3} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={formatar} tickLine={false} axisLine={false} fontSize={11} width={56} />
            <Tooltip formatter={(v) => formatar(Number(v))} labelClassName="capitalize" />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="meta" name={rotuloMeta} fill="var(--muted-foreground)" fillOpacity={0.35} radius={[3, 3, 0, 0]} />
            <Bar dataKey="realizado" name="Realizado" fill="var(--primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
