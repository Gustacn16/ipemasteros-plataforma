import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasPlanejamento } from "@/modulos/planejamento/componentes/abas-planejamento";

/** Planejamento: ver (Painel, Comercial, Marketing) separado de preencher (Cadastrar, Lançar). */
export default async function LayoutPlanejamento({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("planejamento:lancar");
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <CabecalhoPagina titulo="Planejamento" descricao="O plano do ano e se estamos no caminho: metas, realizado e desempenho." />
        <Suspense>
          <AbasPlanejamento ver={temPermissao(usuario.papel, "planejamento:ver")} editor={temPermissao(usuario.papel, "planejamento:editar")} />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
