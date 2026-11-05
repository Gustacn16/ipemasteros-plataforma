import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import type { DadosMidia } from "../../../servicos/dashboard-midia";
import { cartao, textoApagado, tituloCartao } from "../estilos";
import { MiniaturaCriativo } from "./miniatura-criativo";

const porcentagem = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const COR_POSICAO = ["bg-amber-300 text-black", "bg-slate-300 text-black", "bg-orange-400 text-black"];

/** Os criativos com menor custo por lead no mês (mínimo de R$ 50 gastos), com os filtros da tela. */
export function RankingCriativos({ dados }: { dados: DadosMidia }) {
  const { ranking, semLead } = dados.criativos;
  return (
    <section className={cn(cartao, "grid grid-cols-[minmax(0,1fr)] gap-4")} aria-labelledby="titulo-criativos">
      <div>
        <h2 id="titulo-criativos" className={tituloCartao}>
          Melhores criativos
        </h2>
        <p className={cn("text-sm", textoApagado)}>Menor custo por lead no mês, entre os anúncios que gastaram pelo menos R$ 50.</p>
      </div>
      {ranking.length === 0 ? (
        <p className={cn("text-sm", textoApagado)}>
          Nenhum criativo com lead e pelo menos R$ 50 gastos neste filtro. Os anúncios chegam na próxima atualização da Meta.
        </p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {ranking.map((c) => (
            <li key={c.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  COR_POSICAO[c.posicao - 1] ?? "bg-white/10 text-white",
                )}
              >
                {c.posicao}º
              </span>
              <MiniaturaCriativo src={c.miniatura} />
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="truncate font-medium text-white" title={c.nome}>
                  {c.nome}
                </p>
                <p className={cn("truncate text-xs", textoApagado)} title={c.campanha}>
                  {c.campanha}
                </p>
                <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                  <div className="flex gap-1">
                    <dt className={textoApagado}>Custo/lead</dt>
                    <dd className="font-semibold text-emerald-300">{c.cpl ? formatarReais(c.cpl) : "—"}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className={textoApagado}>Leads</dt>
                    <dd className="text-white">{c.leads}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className={textoApagado}>Gasto</dt>
                    <dd className="text-white">{formatarReais(c.investimento)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className={textoApagado}>CTR</dt>
                    <dd className="text-white">{porcentagem(c.ctr)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className={textoApagado}>CPC</dt>
                    <dd className="text-white">{c.cpc ? formatarReais(c.cpc) : "—"}</dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>
      )}
      {semLead > 0 && (
        <p className={cn("text-sm", textoApagado)}>
          {semLead} {semLead === 1 ? "anúncio gastou" : "anúncios gastaram"} R$ 50 ou mais sem trazer lead.
        </p>
      )}
    </section>
  );
}
