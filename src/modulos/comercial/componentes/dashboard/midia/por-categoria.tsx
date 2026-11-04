import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { ROTULO_CATEGORIA, type CategoriaCampanha } from "../../../regras/midia";
import type { DadosMidia } from "../../../servicos/dashboard-midia";
import { cartao, textoApagado, tituloCartao } from "../estilos";

const inteiro = new Intl.NumberFormat("pt-BR");
const porcentagem = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <dt className={textoApagado}>{rotulo}</dt>
      <dd className="font-medium whitespace-nowrap text-white">{valor}</dd>
    </div>
  );
}

/** Métricas por categoria de campanha (pelo nome). Clicar num cartão filtra a tela pela categoria. */
export function PorCategoria({
  dados,
  hrefCategoria,
}: {
  dados: DadosMidia;
  hrefCategoria: (categoria: CategoriaCampanha | null) => string;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-labelledby="titulo-categorias">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-categorias" className={tituloCartao}>
          Por categoria
        </h2>
        {dados.categoria && (
          <Link href={hrefCategoria(null)} scroll={false} className="text-sm text-white/70 hover:text-white">
            Ver todas as categorias
          </Link>
        )}
      </div>
      {dados.porCategoria.length === 0 ? (
        <p className={cn("text-sm", textoApagado)}>Nenhum investimento registrado neste mês.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dados.porCategoria.map((g) => {
            const ativa = dados.categoria === g.categoria;
            return (
              <Link
                key={g.categoria}
                href={hrefCategoria(ativa ? null : g.categoria)}
                scroll={false}
                aria-current={ativa ? "true" : undefined}
                className={cn(cartao, "grid gap-3 transition-colors hover:bg-white/[0.1]", ativa && "border-[#8b7bff] bg-white/[0.1]")}
              >
                <div>
                  <p className="font-medium text-white">{ROTULO_CATEGORIA[g.categoria]}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{formatarReais(g.investimento)}</p>
                </div>
                <dl className="grid gap-1.5">
                  <Linha rotulo="Leads" valor={inteiro.format(g.leads)} />
                  <Linha rotulo="Custo por lead" valor={g.cpl ? formatarReais(g.cpl) : "—"} />
                  <Linha rotulo="Impressões" valor={inteiro.format(g.impressoes)} />
                  <Linha rotulo="Cliques no link" valor={inteiro.format(g.cliquesLink)} />
                  <Linha rotulo="CTR (link)" valor={porcentagem(g.ctr)} />
                  <Linha rotulo="CPC (link)" valor={g.cpc ? formatarReais(g.cpc) : "—"} />
                  <Linha rotulo="Visitas ao perfil" valor={g.visitasPerfil > 0 ? inteiro.format(g.visitasPerfil) : "—"} />
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
