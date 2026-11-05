"use client";

import { CameraIcon, EyeIcon, HeartIcon, LinkIcon, MousePointerClickIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { EstadoVazio } from "@/componentes/estado-vazio";
import type { VisaoInstagram } from "../servicos/visao-instagram";

const numero = new Intl.NumberFormat("pt-BR");
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const formatoAtualizado = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const valor = (v: number | null) => (v === null ? "—" : numero.format(v));
const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Bloco "Instagram" da visão geral: cartões do mês e seguidores dia a dia. */
export function BlocoInstagram({ dados, podeIntegrar }: { dados: VisaoInstagram | null; podeIntegrar: boolean }) {
  if (!dados) {
    if (!podeIntegrar) return null;
    return (
      <section aria-labelledby="bloco-instagram" className="grid gap-3">
        <h2 id="bloco-instagram" className="font-semibold">
          Instagram
        </h2>
        <EstadoVazio
          compacto
          icone={CameraIcon}
          titulo="Instagram não conectado"
          acao={
            <Link href="/conteudo/integracao-instagram" className="text-primary text-sm underline-offset-4 hover:underline">
              Abrir a integração
            </Link>
          }
        />
      </section>
    );
  }

  const c = dados.cartoes;
  const ganhos = c.seguidores.ganhos;
  return (
    <section aria-labelledby="bloco-instagram" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bloco-instagram" className="font-semibold">
          Instagram no mês
        </h2>
        <p className="text-muted-foreground text-xs">
          {dados.atualizadoEm
            ? `Dados do Instagram atualizados em ${formatoAtualizado.format(dados.atualizadoEm).replace(",", " às")}`
            : "Ainda sem atualização concluída."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CartaoNumero rotulo="Seguidores" icone={UsersIcon} valor={valor(c.seguidores.valor)} variacao={c.seguidores.variacao}>
          {ganhos !== null
            ? `${ganhos >= 0 ? "+" : ""}${numero.format(ganhos)} no mês`
            : c.novosSeguidores.valor !== null
              ? `${numero.format(c.novosSeguidores.valor)} novos no mês`
              : null}
        </CartaoNumero>
        <CartaoNumero rotulo="Alcance" icone={UsersIcon} valor={valor(c.alcance.valor)} variacao={c.alcance.variacao}>
          Pessoas diferentes que viram o perfil
        </CartaoNumero>
        <CartaoNumero rotulo="Visualizações" icone={EyeIcon} valor={valor(c.visualizacoes.valor)} variacao={c.visualizacoes.variacao} />
        <CartaoNumero rotulo="Interações" icone={HeartIcon} valor={valor(c.interacoes.valor)} variacao={c.interacoes.variacao}>
          Curtidas, comentários, salvamentos e compartilhamentos
        </CartaoNumero>
        <CartaoNumero
          rotulo="Visitas ao perfil"
          icone={MousePointerClickIcon}
          valor={valor(c.visitasPerfil.valor)}
          variacao={c.visitasPerfil.variacao}
        >
          Vindas dos posts e stories
        </CartaoNumero>
        <CartaoNumero
          rotulo="Cliques no link da bio"
          icone={LinkIcon}
          valor={valor(c.cliquesLink.valor)}
          variacao={c.cliquesLink.variacao}
        />
      </div>
      {dados.seguidoresPorDia.length > 1 && (
        <div className="bg-card grid gap-2 rounded-xl border p-4" aria-label="Seguidores por dia no mês">
          <p className="text-muted-foreground text-sm">Seguidores por dia</p>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.seguidoresPorDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="data"
                  tickFormatter={diaCurto}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => compacto.format(v)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => [numero.format(Number(v)), "Seguidores"]}
                  labelFormatter={(d) => diaCurto(String(d))}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Line type="monotone" dataKey="seguidores" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
