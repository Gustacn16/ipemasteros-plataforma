import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BarraFiltros } from "@/modulos/conteudo/componentes/barra-filtros";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { MenuConteudo } from "@/modulos/conteudo/componentes/menu-conteudo";
import { listarContas } from "@/modulos/conteudo/servicos/contas";
import { listarPessoas } from "@/modulos/conteudo/servicos/conteudos";

/** Área do módulo Conteúdo: menu próprio (visões e contas) ao lado do conteúdo. */
export default async function LayoutConteudo({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const [contas, pessoas, filtro] = await Promise.all([listarContas(), listarPessoas(), lerFiltro()]);

  return (
    <div className="-m-4 flex flex-1 flex-col md:-m-8 md:flex-row">
      <MenuConteudo
        contas={contas}
        filtro={filtro}
        podeConfigurar={temPermissao(usuario.papel, "conteudo:gerenciar_canais")}
        podeIntegrar={temPermissao(usuario.papel, "conteudo:gerenciar_integracao_instagram")}
      />
      <div className="min-w-0 flex-1 p-4 md:p-8">
        <BarraFiltros filtro={filtro} contas={contas} pessoas={pessoas} />
        {children}
      </div>
    </div>
  );
}
