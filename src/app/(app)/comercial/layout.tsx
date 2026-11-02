import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasComercial } from "@/modulos/comercial/componentes/abas-comercial";

/** Área do módulo Comercial: título e abas acima do conteúdo. */
export default async function LayoutComercial({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Comercial</h1>
        <AbasComercial podeGerenciar={temPermissao(usuario.papel, "comercial:gerenciar_produtos")} />
      </div>
      {children}
    </div>
  );
}
