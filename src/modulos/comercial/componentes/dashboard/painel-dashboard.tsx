import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DadosDashboard } from "../../servicos/dashboard";
import type { DadosMidia } from "../../servicos/dashboard-midia";
import { CartoesNumeros } from "./cartoes-numeros";
import { FiltrosDashboard } from "./filtros-dashboard";
import { GraficoVendas } from "./grafico-vendas";
import { CartaoKommo, RankingVendedores, TabelaProdutos, VendasRecentes } from "./listas";
import { PainelMidia } from "./midia/painel-midia";

type Opcao = { id: string; nome: string };

/**
 * Dashboard comercial com tema escuro só aqui dentro (classe `dark`): fundo
 * grafite da marca (#111416) com brilho roxo (#5F45F4) e cartões translúcidos.
 */
type Props = {
  dados: DadosDashboard;
  produtos: Opcao[];
  vendedores: Opcao[];
  /** Só chega preenchido para quem tem `comercial:ver_marketing` e está na visão Mídia. */
  midia: DadosMidia | null;
  /** Links do seletor "Vendas | Mídia"; `null` quando a pessoa não vê mídia. */
  links: { vendas: string; midia: string; campanha: (id: string) => string } | null;
};

export function PainelDashboard({ dados, produtos, vendedores, midia, links }: Props) {
  const pilulaVisao = (ativa: boolean) =>
    cn("rounded-full px-4 py-1.5 text-sm", ativa ? "bg-white/15 font-medium text-white" : "text-white/60 hover:text-white");
  return (
    <div className="dark relative overflow-hidden rounded-[2rem] bg-[#111416] p-4 text-white sm:p-6 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(95,69,244,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(95,69,244,0.12),transparent_50%)]"
      />
      {/* minmax(0,1fr): a rolagem lateral das vendas recentes não alarga a página no celular. */}
      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-3">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Dashboard</h2>
            {!dados.equipe && <p className="text-sm text-white/60">Seus números</p>}
            {links && (
              <nav aria-label="Visão do dashboard" className="flex w-fit rounded-full bg-white/[0.06] p-1">
                <Link href={links.vendas} aria-current={midia ? undefined : "page"} className={pilulaVisao(!midia)}>
                  Vendas
                </Link>
                <Link href={links.midia} aria-current={midia ? "page" : undefined} className={pilulaVisao(Boolean(midia))}>
                  Mídia
                </Link>
              </nav>
            )}
          </div>
          <FiltrosDashboard mes={dados.mes} produtos={midia ? null : produtos} vendedores={!midia && dados.equipe ? vendedores : null} />
        </div>
        {midia && links ? <PainelMidia dados={midia} hrefCampanha={links.campanha} /> : <ConteudoVendas dados={dados} />}
      </div>
    </div>
  );
}

function ConteudoVendas({ dados }: { dados: DadosDashboard }) {
  return (
    <>
      <CartoesNumeros numeros={dados.numeros} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <GraficoVendas serie={dados.serie} />
        <div className="grid content-start gap-4">
          {dados.equipe && <RankingVendedores ranking={dados.ranking} />}
          <CartaoKommo />
        </div>
      </div>
      <TabelaProdutos produtos={dados.porProduto} />
      <VendasRecentes vendas={dados.recentes} />
    </>
  );
}
