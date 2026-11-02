import { Suspense } from "react";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { MenuConteudo } from "@/modulos/conteudo/componentes/menu-conteudo";
import { listarContas } from "@/modulos/conteudo/servicos/contas";

/** Área do módulo Conteúdo: menu próprio (visões e contas) ao lado do conteúdo. */
export default async function LayoutConteudo({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const contas = await listarContas();

  return (
    <div className="-m-4 flex flex-1 flex-col md:-m-8 md:flex-row">
      <Suspense>
        <MenuConteudo contas={contas} podeConfigurar={temPermissao(usuario.papel, "conteudo:gerenciar_canais")} />
      </Suspense>
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
