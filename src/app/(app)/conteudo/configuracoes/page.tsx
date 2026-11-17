import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { CartaoMarca, NovaMarca } from "@/modulos/conteudo/componentes/configurar-contas";
import { listarContas } from "@/modulos/conteudo/servicos/contas";

export const metadata: Metadata = { title: "Contas e canais — IPEMaster OS" };

export default async function PaginaConfiguracoesConteudo() {
  await exigirPermissaoPagina("conteudo:gerenciar_canais");
  const contas = await listarContas({ todos: true });

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <CabecalhoPagina
        titulo="Contas e canais"
        descricao="Cada conta (ex.: IPEMaster, Pedro Prado) tem suas plataformas, e cada plataforma os seus formatos. Canal ou formato desativado some dos formulários, mas o histórico fica."
      />
      {contas.map((c) => (
        // A key com os dados remonta o cartão quando o servidor devolve mudanças.
        <CartaoMarca key={`${c.id}-${c.nome}-${c.canais.length}-${c.canais.map((k) => `${k.identificador}${k.ativo}${k.formatos.map((f) => f.id + f.nome + f.ativo).join()}`).join()}`} conta={c} />
      ))}
      <NovaMarca />
    </div>
  );
}
