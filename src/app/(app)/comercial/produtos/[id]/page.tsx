import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SeloInativo, SeloTipo, descreverComissao } from "@/modulos/comercial/componentes/exibicao";
import { AcoesProduto, FormularioProduto } from "@/modulos/comercial/componentes/formulario-produto";
import { LinksProduto } from "@/modulos/comercial/componentes/links-produto";
import { OfertasProduto } from "@/modulos/comercial/componentes/ofertas-produto";
import { cargaTotal } from "@/modulos/comercial/regras/produto";
import { obterProduto, type ProdutoDetalhe } from "@/modulos/comercial/servicos/produtos";

export const metadata: Metadata = { title: "Produto — IPEMaster OS" };

/** Converte "não encontrado" do serviço em 404; outros erros seguem. */
async function ou404<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
}

function Item({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm">{valor ?? "—"}</dd>
    </div>
  );
}

/** Ficha do produto para quem só consulta (papel comercial). */
function FichaProduto({ produto }: { produto: ProdutoDetalhe }) {
  const total = cargaTotal(produto);
  const textos = [
    ["Descrição", produto.descricao],
    ["Ementa", produto.ementa],
    ["Observações", produto.observacoes],
  ] as const;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Dados gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Item rotulo="Área" valor={produto.area} />
            <Item rotulo="SKU" valor={produto.sku} />
            <Item rotulo="Duração" valor={produto.duracaoMeses ? `${produto.duracaoMeses} meses` : null} />
            <Item rotulo="Recorrente" valor={produto.recorrente ? "Sim" : "Não"} />
            <Item rotulo="Responsável pedagógico" valor={produto.responsavelPedagogico} />
            <Item rotulo="Carga horária total" valor={total !== null ? `${total}h` : null} />
            <Item
              rotulo="Comissão"
              valor={`${descreverComissao(produto.comissaoTipo, produto.comissaoBase)} base / ${descreverComissao(produto.comissaoTipo, produto.comissaoBonus)} bônus`}
            />
            <div className="sm:col-span-2">
              <Item rotulo="Corpo docente" valor={produto.corpoDocente} />
            </div>
          </dl>
        </CardContent>
      </Card>
      {textos
        .filter(([, valor]) => valor)
        .map(([titulo, valor]) => (
          <Card key={titulo}>
            <CardHeader>
              <CardTitle>{titulo}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-line">{valor}</CardContent>
          </Card>
        ))}
    </>
  );
}

export default async function PaginaProduto({ params }: PageProps<"/comercial/produtos/[id]">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const { id } = await params;
  const produto = await ou404(obterProduto(usuario, id));
  const podeEditar = temPermissao(usuario.papel, "comercial:gerenciar_produtos");

  return (
    <div className="grid max-w-4xl gap-4">
      <Link href="/comercial/produtos" className="text-muted-foreground flex items-center gap-1 text-sm hover:underline">
        <ArrowLeftIcon className="size-4" /> Produtos
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">{produto.nome}</h2>
          <div className="flex items-center gap-2">
            <SeloTipo tipo={produto.tipo} />
            {!produto.ativo && <SeloInativo />}
          </div>
        </div>
        {podeEditar && (
          <AcoesProduto id={produto.id} ativo={produto.ativo} podeExcluir={temPermissao(usuario.papel, "comercial:excluir_produtos")} />
        )}
      </header>

      <OfertasProduto produtoId={produto.id} ofertas={produto.ofertas} podeEditar={podeEditar} />
      <LinksProduto produtoId={produto.id} links={produto.links} podeEditar={podeEditar} />
      {podeEditar ? <FormularioProduto produto={produto} /> : <FichaProduto produto={produto} />}
    </div>
  );
}
