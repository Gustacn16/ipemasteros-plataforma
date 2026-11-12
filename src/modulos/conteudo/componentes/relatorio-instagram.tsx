"use client";

import { CameraIcon, EyeIcon, HeartIcon, MousePointerClickIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { CLASSE_TITULO_SECAO } from "@/modulos/tarefas/componentes/exibicao";
import type { RelatorioInstagram as Dados } from "../servicos/visao-instagram";
import { Miniatura, TIPO_MIDIA } from "./ligar-midia";

const numero = new Intl.NumberFormat("pt-BR");
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const valor = (v: number | null) => (v === null ? "—" : numero.format(v));
const comSinal = (v: number) => `${v > 0 ? "+" : ""}${numero.format(v)}`;
const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** O gráfico de seguidores só aparece com uma semana de histórico (a Meta só dá o total do dia). */
const MIN_DIAS_SEGUIDORES = 7;

const estiloDica = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
};

/** Foto do perfil; o link da Meta expira, então cai para um ícone quando não carrega. */
export function FotoConta({ url }: { url: string | null }) {
  const [falhou, setFalhou] = useState(false);
  if (!url || falhou)
    return (
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
        <CameraIcon className="size-5" aria-hidden />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setFalhou(true)} className="size-10 shrink-0 rounded-full object-cover" />;
}

/** Cartões, gráficos e posts de maior alcance do mês, na aba Relatórios. */
export function RelatorioInstagram({ dados, mes }: { dados: Dados; mes: string }) {
  const c = dados.cartoes;
  const comparacao = dados.parcial
    ? dados.diasComparados
      ? `Comparação com os dias 1 a ${dados.diasComparados} do mês anterior.`
      : "O mês começou hoje: os números aparecem a partir de amanhã."
    : "Comparação com o mês anterior inteiro.";
  const seguidoresPorDia = dados.porDia.filter((d) => d.seguidores !== null);
  const i = c.interacoes;

  return (
    <>
      <section aria-labelledby="sec-numeros" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sec-numeros" className={CLASSE_TITULO_SECAO}>
            Números do mês
          </h2>
          <p className="text-muted-foreground text-xs">{comparacao}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CartaoNumero rotulo="Seguidores" icone={UsersIcon} valor={valor(c.seguidores.valor)}>
            {c.seguidores.novos !== null || c.seguidores.sairam !== null ? (
              <>
                {valor(c.seguidores.novos)} novos · {valor(c.seguidores.sairam)} deixaram de seguir
                {c.seguidores.saldo !== null && ` · saldo ${comSinal(c.seguidores.saldo)}`}
              </>
            ) : (
              "A Meta ainda não informou quem seguiu neste mês"
            )}
          </CartaoNumero>
          <CartaoNumero rotulo="Alcance" icone={UsersIcon} valor={valor(c.alcance.valor)} variacao={c.alcance.variacao}>
            {dados.alcanceAproximado
              ? "Pessoas diferentes; aproximado, porque a Meta só dá 30 dias de alcance"
              : dados.parcial
                ? "Pessoas diferentes; compara quando o mês fechar"
                : "Pessoas diferentes que viram a conta"}
          </CartaoNumero>
          <CartaoNumero rotulo="Visualizações" icone={EyeIcon} valor={valor(c.visualizacoes.valor)} variacao={c.visualizacoes.variacao} />
          <CartaoNumero rotulo="Interações" icone={HeartIcon} valor={valor(i.valor)} variacao={i.variacao}>
            {valor(i.curtidas)} curtidas · {valor(i.comentarios)} comentários · {valor(i.salvamentos)} salvamentos ·{" "}
            {valor(i.compartilhamentos)} compartilhamentos
          </CartaoNumero>
          <CartaoNumero
            rotulo="Visitas ao perfil"
            icone={MousePointerClickIcon}
            valor={valor(c.visitasPerfil.valor)}
            variacao={c.visitasPerfil.variacao}
          >
            Só de posts comuns e stories: a Meta não informa as visitas vindas de Reels
          </CartaoNumero>
        </div>
      </section>

      {dados.porDia.length > 1 && (
        <section aria-labelledby="sec-por-dia" className="bg-card grid gap-2 rounded-xl border p-4">
          <h2 id="sec-por-dia" className="text-muted-foreground text-sm">
            Visualizações e alcance por dia
          </h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="data"
                  tickFormatter={diaCurto}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tickFormatter={(v: number) => compacto.format(v)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => numero.format(Number(v))}
                  labelFormatter={(d) => diaCurto(String(d))}
                  contentStyle={estiloDica}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line name="Visualizações" type="monotone" dataKey="visualizacoes" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line name="Alcance" type="monotone" dataKey="alcance" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {seguidoresPorDia.length >= MIN_DIAS_SEGUIDORES && (
        <section aria-labelledby="sec-seguidores" className="bg-card grid gap-2 rounded-xl border p-4">
          <h2 id="sec-seguidores" className="text-muted-foreground text-sm">
            Seguidores por dia
          </h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seguidoresPorDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
                  allowDecimals={false}
                  tickFormatter={(v: number) => numero.format(v)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => [numero.format(Number(v)), "Seguidores"]}
                  labelFormatter={(d) => diaCurto(String(d))}
                  contentStyle={estiloDica}
                />
                <Line type="monotone" dataKey="seguidores" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section aria-labelledby="sec-top" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sec-top" className={CLASSE_TITULO_SECAO}>
            Maior alcance no mês
          </h2>
          <Link href={`/conteudo/publicados?mes=${mes}&ordem=alcance`} className="text-primary text-sm underline-offset-4 hover:underline">
            Ver todos em Publicados
          </Link>
        </div>
        {dados.maisAlcance.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum post ou story neste mês.</p>
        ) : (
          <ol className="grid gap-2">
            {dados.maisAlcance.map((m) => (
              <li key={m.id} className="bg-card flex min-w-0 items-center gap-3 rounded-xl border p-3 text-sm">
                <Miniatura url={m.miniaturaUrl} tipo={m.tipo} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline">
                    {m.publicacao?.conteudo.titulo ?? (m.legenda || "Sem legenda")}
                  </a>
                  <span className="text-muted-foreground text-xs">
                    {TIPO_MIDIA[m.tipo].rotulo} · {formatoData.format(m.publicadoEm)} · @{m.conta.usuario}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">{valor(m.alcance)}</span>
                  <span className="text-muted-foreground text-xs">alcance</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
