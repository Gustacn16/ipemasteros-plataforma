import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import type { DadosDashboard } from "../../servicos/dashboard";
import { BarraMeta } from "./barra-meta";
import { cartao, reaisCompacto, textoApagado, tituloCartao } from "./estilos";

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short" });
const dataCurta = (dia: string) => formatoDia.format(new Date(`${dia}T00:00:00Z`)).replace(".", "");

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function Avatar({ nome, imagem }: { nome: string; imagem: string | null }) {
  return imagem ? (
    // Foto servida por rota protegida; não passa pelo otimizador de imagens.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imagem} alt="" draggable={false} className="size-10 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#5f45f4]/30 text-sm font-semibold text-white">
      {iniciais(nome)}
    </span>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className={cn("text-sm", textoApagado)}>{texto}</p>;
}

export function RankingVendedores({ ranking }: { ranking: DadosDashboard["ranking"] }) {
  return (
    <section className={cn(cartao, "grid grid-cols-[minmax(0,1fr)] gap-4")} aria-labelledby="titulo-ranking">
      <h2 id="titulo-ranking" className={tituloCartao}>
        Ranking de vendedores
      </h2>
      {ranking.length === 0 ? (
        <Vazio texto="Nenhuma venda registrada neste mês." />
      ) : (
        <ol className="grid gap-4">
          {ranking.map((v, i) => (
            <li key={v.vendedorId} className="flex items-center gap-3">
              <span className="w-5 text-sm text-white/50">{i + 1}</span>
              <Avatar nome={v.nome} imagem={v.imagem} />
              <div className="grid min-w-0 flex-1 gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-white">{v.nome}</span>
                  <span className="text-sm whitespace-nowrap text-white">{formatarReais(v.vendido)}</span>
                </div>
                <div className={cn("flex justify-between text-xs", textoApagado)}>
                  <span>
                    {v.quantidade} {v.quantidade === 1 ? "venda" : "vendas"}
                  </span>
                  <span>{Number(v.meta) > 0 ? `meta ${reaisCompacto(v.meta)}` : "sem meta"}</span>
                </div>
                <BarraMeta percentual={v.percentual} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function TabelaProdutos({ produtos }: { produtos: DadosDashboard["porProduto"] }) {
  return (
    <section className={cn(cartao, "grid grid-cols-[minmax(0,1fr)] gap-4")} aria-labelledby="titulo-produtos">
      <h2 id="titulo-produtos" className={tituloCartao}>
        Por produto
      </h2>
      {produtos.length === 0 ? (
        <Vazio texto="Nenhuma venda registrada neste mês." />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {produtos.map((p) => (
            <li key={p.produtoId} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-white">{p.nome}</span>
                <span className="text-sm whitespace-nowrap text-white">
                  {reaisCompacto(p.vendido)}
                  {Number(p.metaValor) > 0 && <span className="text-white/50"> / {reaisCompacto(p.metaValor)}</span>}
                </span>
              </div>
              <span className={cn("text-xs", textoApagado)}>
                {p.quantidade} {p.quantidade === 1 ? "venda" : "vendas"}
                {p.metaQuantidade > 0 && ` de ${p.metaQuantidade} na meta`}
              </span>
              <BarraMeta percentual={p.percentualValor} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VendasRecentes({ vendas }: { vendas: DadosDashboard["recentes"] }) {
  return (
    <section className="grid gap-3" aria-labelledby="titulo-recentes">
      <h2 id="titulo-recentes" className={tituloCartao}>
        Vendas recentes
      </h2>
      {vendas.length === 0 ? (
        <Vazio texto="Nenhuma venda registrada neste mês." />
      ) : (
        <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {vendas.map((v) => (
            <li key={v.id} className={cn(cartao, "min-w-60 flex-1 snap-start")}>
              <p className={cn("text-xs", textoApagado)}>{dataCurta(v.dataVenda)}</p>
              <p className="mt-1 line-clamp-2 font-medium text-white">{v.produtoNome}</p>
              <p className={cn("truncate text-sm", textoApagado)}>{v.nomeCliente}</p>
              <p className="mt-3 text-xl font-semibold text-white">{formatarReais(v.valorTotal)}</p>
              <p className={cn("text-xs", textoApagado)}>{v.vendedorNome}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CartaoKommo() {
  return (
    <section className={cn(cartao, "grid gap-2 border-dashed")} aria-labelledby="titulo-kommo">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-kommo" className={tituloCartao}>
          Funil do Kommo
        </h2>
        <span className="rounded-full bg-[#5f45f4]/30 px-2.5 py-0.5 text-xs font-medium text-white">Em breve</span>
      </div>
      <p className={cn("text-sm", textoApagado)}>Leads, etapas do funil e conversão em venda, direto do Kommo.</p>
    </section>
  );
}
