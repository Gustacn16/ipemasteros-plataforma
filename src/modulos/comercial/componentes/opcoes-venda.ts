// Opções dos campos de escolha do formulário de venda. Ao editar uma venda antiga,
// mantém o produto (com a oferta escolhida), o vendedor e o canal que ela já tinha,
// mesmo que tenham sido desativados depois — senão o campo vazio apagaria o dado ao salvar.
import type { ProdutoParaVenda } from "../servicos/produtos";

type Pessoa = { id: string; nome: string };

type VendaAtual = {
  produtoId: string;
  produtoNome: string;
  ofertaId: string | null;
  ofertaNome: string | null;
  vendedorId: string;
  vendedorNome: string;
  canalId: string | null;
  canalNome: string | null;
};

export function opcoesDoFormulario(o: { produtos: ProdutoParaVenda[]; vendedores: Pessoa[]; canais: Pessoa[]; venda: VendaAtual | null }) {
  const { venda } = o;
  if (!venda) return { produtos: o.produtos, vendedores: o.vendedores, canais: o.canais };

  const produtos = o.produtos.some((p) => p.id === venda.produtoId)
    ? o.produtos
    : [
        ...o.produtos,
        {
          id: venda.produtoId,
          nome: venda.produtoNome,
          tipo: "curso_livre" as const,
          // Só a oferta da venda: os valores de pagamento já estão gravados nela.
          ofertas: venda.ofertaId
            ? [
                {
                  id: venda.ofertaId,
                  nome: venda.ofertaNome ?? "",
                  padrao: false,
                  precoCheio: "0.00",
                  matricula: "0.00",
                  parcelas: 0,
                  valorParcela: "0.00",
                },
              ]
            : [],
        },
      ];
  const vendedores = o.vendedores.some((v) => v.id === venda.vendedorId)
    ? o.vendedores
    : [...o.vendedores, { id: venda.vendedorId, nome: venda.vendedorNome }];
  const canais =
    venda.canalId && !o.canais.some((c) => c.id === venda.canalId)
      ? [...o.canais, { id: venda.canalId, nome: venda.canalNome ?? "" }]
      : o.canais;
  return { produtos, vendedores, canais };
}
