import type { Metadata } from "next";
import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SeloInativo } from "@/modulos/comercial/componentes/exibicao";
import { FiltrosProdutos } from "@/modulos/comercial/componentes/filtros-produtos";
import { NovoProduto } from "@/modulos/comercial/componentes/novo-produto";
import { ROTULO_TIPO_PRODUTO, TIPOS_PRODUTO, esquemaFiltrosProdutos } from "@/modulos/comercial/esquemas/produto";
import { listarAreas, listarProdutos } from "@/modulos/comercial/servicos/produtos";

export const metadata: Metadata = { title: "Produtos — IPEMaster OS" };

export default async function PaginaProdutos({ searchParams }: PageProps<"/comercial/produtos">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosProdutos.parse({
    tipo: texto(busca.tipo),
    area: texto(busca.area),
    situacao: texto(busca.situacao),
  });
  const [produtos, areas] = await Promise.all([listarProdutos(usuario, filtros), listarAreas()]);

  return (
    <div className="grid max-w-4xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltrosProdutos areas={areas} />
        {temPermissao(usuario.papel, "comercial:gerenciar_produtos") && <NovoProduto />}
      </div>

      {produtos.length === 0 && <p className="text-muted-foreground text-sm">Nenhum produto neste filtro.</p>}

      {TIPOS_PRODUTO.filter((t) => produtos.some((p) => p.tipo === t)).map((tipo) => {
        const doTipo = produtos.filter((p) => p.tipo === tipo);
        return (
          <section key={tipo} aria-labelledby={`tipo-${tipo}`} className="grid gap-2">
            <h2 id={`tipo-${tipo}`} className="font-semibold">
              {ROTULO_TIPO_PRODUTO[tipo]} <span className="text-muted-foreground font-normal">{doTipo.length}</span>
            </h2>
            <ul className="divide-y rounded-md border">
              {doTipo.map((p) => (
                <li key={p.id}>
                  <Link href={`/comercial/produtos/${p.id}`} className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="truncate">{p.nome}</span>
                        {!p.ativo && <SeloInativo />}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {[p.area, p.sku, `${p.quantidadeOfertas} ${p.quantidadeOfertas === 1 ? "oferta" : "ofertas"}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-sm whitespace-nowrap">{p.precoPadrao ? formatarReais(p.precoPadrao) : "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
