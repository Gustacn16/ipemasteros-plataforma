import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { tomVariacao } from "../../../regras/dashboard";
import { ROTULO_CATEGORIA, formatarRoas, type CategoriaCampanha } from "../../../regras/midia";
import type { DadosMidia } from "../../../servicos/dashboard-midia";
import { cartao, textoApagado, tituloCartao } from "../estilos";
import { FiltrosMidia } from "./filtros-midia";
import { GraficoMidia } from "./grafico-midia";
import { PorCategoria } from "./por-categoria";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const COR_VARIACAO = {
  subiu: "bg-emerald-400/20 text-emerald-300",
  caiu: "bg-rose-400/20 text-rose-300",
  igual: "bg-white/10 text-white/70",
} as const;

function Numero({ rotulo, valor, children }: { rotulo: string; valor: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cartao}>
      <p className={cn("text-sm", textoApagado)}>{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight whitespace-nowrap text-white sm:text-3xl">{valor}</p>
      {children && <div className={cn("mt-2 text-sm", textoApagado)}>{children}</div>}
    </div>
  );
}

/** Visão Mídia do dashboard: números do Meta Ads no mês, gráfico e tabela por campanha. */
export function PainelMidia({
  dados,
  hrefCampanha,
  hrefCategoria,
}: {
  dados: DadosMidia;
  hrefCampanha: (id: string) => string;
  hrefCategoria: (categoria: CategoriaCampanha | null) => string;
}) {
  const n = dados.numeros;
  const tom = tomVariacao(n.variacaoInvestimento);
  const dicaTotais = dados.filtrando ? "Só no total, sem filtro de campanha" : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid gap-3">
        <p className={cn("text-sm", textoApagado)}>
          {dados.atualizadoEm ? (
            `Dados da Meta atualizados em ${formatoDataHora.format(new Date(dados.atualizadoEm))}.`
          ) : (
            <>
              Meta Ads não conectada.{" "}
              <Link href="/comercial/integracao-meta" className="underline">
                Configurar
              </Link>
            </>
          )}{" "}
          O filtro por produto chega com a ligação de campanhas a produtos.
        </p>
        <FiltrosMidia contas={dados.opcoes.contas} campanhas={dados.opcoes.campanhas} />
        {dados.categoria && (
          <p className="text-sm text-white">
            Categoria: <strong>{ROTULO_CATEGORIA[dados.categoria]}</strong>{" "}
            <Link href={hrefCategoria(null)} scroll={false} className="text-white/70 underline hover:text-white">
              tirar
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Numero rotulo="Investimento" valor={formatarReais(n.investimento)}>
          {tom && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", COR_VARIACAO[tom])}>
              {n.variacaoInvestimento! > 0 ? "+" : ""}
              {n.variacaoInvestimento}% vs mês passado
            </span>
          )}
        </Numero>
        <Numero rotulo="Leads" valor={n.leads}>
          {n.leadsFormulario} formulário · {n.leadsSite} site · {n.conversasIniciadas} WhatsApp
        </Numero>
        <Numero rotulo="Custo por lead" valor={n.cpl ? formatarReais(n.cpl) : "—"} />
        <Numero rotulo="CAC" valor={n.cac ? formatarReais(n.cac) : "—"}>
          {dicaTotais ?? `${n.vendas} ${n.vendas === 1 ? "venda" : "vendas"} no mês`}
        </Numero>
        <Numero rotulo="ROAS" valor={formatarRoas(n.roas)}>
          {dicaTotais ?? `${formatarReais(n.vendido)} vendidos`}
        </Numero>
      </div>

      <GraficoMidia serie={dados.serie} />

      <section className={cn(cartao, "grid grid-cols-[minmax(0,1fr)] gap-4")} aria-labelledby="titulo-campanhas">
        <h2 id="titulo-campanhas" className={tituloCartao}>
          Por campanha
        </h2>
        {dados.campanhas.length === 0 ? (
          <p className={cn("text-sm", textoApagado)}>
            {dados.filtrando ? "Nenhum investimento registrado neste filtro." : "Nenhum investimento registrado neste mês."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className={cn("text-left text-xs", textoApagado)}>
                  <th className="pb-2 font-normal">Campanha</th>
                  <th className="pb-2 font-normal">Conta</th>
                  <th className="pb-2 font-normal">Situação</th>
                  <th className="pb-2 text-right font-normal">Investimento</th>
                  <th className="pb-2 text-right font-normal">Leads</th>
                  <th className="pb-2 text-right font-normal">Custo por lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {dados.campanhas.map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-72 py-2 pr-3">
                      <Link
                        href={hrefCampanha(c.id)}
                        scroll={false}
                        className="block truncate text-white hover:underline"
                        title="Filtrar por esta campanha"
                      >
                        {c.nome}
                      </Link>
                    </td>
                    <td className={cn("py-2 pr-3", textoApagado)}>{c.conta}</td>
                    <td className={cn("py-2 pr-3", textoApagado)}>{c.status === "ACTIVE" ? "Ativa" : "Pausada"}</td>
                    <td className="py-2 text-right whitespace-nowrap text-white">{formatarReais(c.investimento)}</td>
                    <td className="py-2 text-right text-white">{c.leads}</td>
                    <td className="py-2 text-right whitespace-nowrap text-white">{c.cpl ? formatarReais(c.cpl) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PorCategoria dados={dados} hrefCategoria={hrefCategoria} />
    </div>
  );
}
