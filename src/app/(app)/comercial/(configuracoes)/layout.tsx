import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { itensConfiguracao, SubabasConfiguracoes } from "@/modulos/comercial/componentes/subabas-configuracoes";

/** Aba Configurações do Comercial: canais, integração com a Meta e aviso de venda, com pílulas no topo. */
export default async function LayoutConfiguracoesComercial({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const itens = itensConfiguracao({
    canais: temPermissao(usuario.papel, "comercial:gerenciar_produtos"),
    meta: temPermissao(usuario.papel, "comercial:gerenciar_integracao_meta"),
    avisoVenda: temPermissao(usuario.papel, "comercial:gerenciar_aviso_venda"),
  });
  return (
    <div className="grid gap-5">
      <SubabasConfiguracoes itens={itens} />
      {children}
    </div>
  );
}
