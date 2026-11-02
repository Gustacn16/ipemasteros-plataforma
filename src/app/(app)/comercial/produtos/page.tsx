import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { CartaoProduto } from "@/modulos/comercial/componentes/cartao-produto";
import { FiltrosProdutos } from "@/modulos/comercial/componentes/filtros-produtos";
import { NovoProduto } from "@/modulos/comercial/componentes/novo-produto";
import { ROTULO_TIPO_PRODUTO, esquemaFiltrosProdutos, type TipoProduto } from "@/modulos/comercial/esquemas/produto";
import { listarAreas, listarProdutos } from "@/modulos/comercial/servicos/produtos";

export const metadata: Metadata = { title: "Produtos — IPEMaster OS" };

// Ordem das prateleiras na estante.
const PRATELEIRAS: readonly TipoProduto[] = ["pos_graduacao", "curso_livre", "paciente_modelo"];

export default async function PaginaProdutos({ searchParams }: PageProps<"/comercial/produtos">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosProdutos.parse({
    tipo: texto(busca.tipo),
    area: texto(busca.area),
    busca: texto(busca.busca),
    situacao: texto(busca.situacao),
  });
  const [produtos, areas] = await Promise.all([listarProdutos(usuario, filtros), listarAreas()]);
  const podeExcluir = temPermissao(usuario.papel, "comercial:excluir_produtos");

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltrosProdutos areas={areas} />
        {temPermissao(usuario.papel, "comercial:gerenciar_produtos") && <NovoProduto />}
      </div>

      {produtos.length === 0 && <p className="text-muted-foreground text-sm">Nenhum produto neste filtro.</p>}

      {PRATELEIRAS.filter((t) => produtos.some((p) => p.tipo === t)).map((tipo) => {
        const doTipo = produtos.filter((p) => p.tipo === tipo);
        return (
          <section key={tipo} aria-labelledby={`tipo-${tipo}`} className="grid gap-3">
            <h2 id={`tipo-${tipo}`} className="font-semibold">
              {ROTULO_TIPO_PRODUTO[tipo]} <span className="text-muted-foreground font-normal">{doTipo.length}</span>
            </h2>
            {/* A "prateleira": cartões lado a lado sobre uma borda inferior mais grossa. */}
            <ul className="grid gap-3 border-b-4 border-neutral-200 pb-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {doTipo.map((p) => (
                <li key={p.id}>
                  <CartaoProduto produto={p} podeExcluir={podeExcluir} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
