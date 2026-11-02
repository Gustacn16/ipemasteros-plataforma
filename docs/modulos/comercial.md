# Módulo: Comercial

## Objetivo
Tirar o controle comercial das planilhas: catálogo de produtos, registro de vendas, metas mensais por produto e vendedor, e um dashboard do realizado contra a meta. Substitui o antigo módulo "Dashboard" (F6), cuja integração com Meta Ads e Kommo vira entrega própria.

Especificação: `docs/superpowers/specs/2026-11-02-comercial-design.md`.

## Entidades
| Entidade | Campos principais |
|---|---|
| `Produto` | id, nome, tipo (`curso_livre`/`paciente_modelo`/`pos_graduacao`), area, sku (único entre não excluídos), ativo, duracaoMeses, recorrente, responsavelPedagogico, corpoDocente, cargas (teórica presencial, síncrona, assíncrona, prática, extra), comissaoTipo (`valor`/`percentual`), comissaoBase, comissaoBonus, descricao, ementa, observacoes, excluidoEm |
| `OfertaProduto` | id, produtoId, nome, padrao (no máximo uma por produto), precoCheio, matricula, parcelas (0 = à vista), valorParcela, descontoPontualidadePct, formasPagamento (`pix`/`cartao`/`boleto`/`transferencia`), link, ordem |
| `LinkProduto` | id, produtoId, titulo, url, categoria (`vendas`/`aulas`/`outro`), ordem |
| `CanalVenda` | id, nome (único), ativo, ordem |

O catálogo é **único no sistema**: o Acadêmico vai usar os mesmos produtos (o `Curso` de `academico.md` passa a ser o `Produto`). Dinheiro em `Decimal(12,2)`; entre servidor e tela trafega como string `"3300.00"` (`src/lib/dinheiro.ts`).

## Telas
- `/comercial`: por enquanto leva a Produtos (o dashboard chega na entrega 4).
- `/comercial/produtos`: catálogo agrupado por tipo, com filtros na URL (`tipo`, `area`, `situacao=ativos|inativos|todos`) e "+ Novo produto".
- `/comercial/produtos/[id]`: ofertas e preços, links, dados gerais, carga horária, comissão, descrição, ementa e observações. Ações "Desativar/Ativar" e "Excluir". O papel `comercial` vê a ficha só para leitura.
- `/comercial/canais`: lista editável de canais de venda.

## Regras de negócio
1. A primeira oferta de um produto vira a padrão. Marcar outra como padrão desmarca as demais. Excluir a padrão passa a marca para a primeira oferta restante.
2. Produto inativo ou excluído some dos campos de escolha, mas continua nas vendas e metas antigas.
3. Excluir produto só é permitido sem vendas nem metas; senão, o sistema orienta a desativar. A exclusão é lógica (`excluidoEm`).
4. SKU é normalizado em maiúsculas e não pode repetir entre produtos não excluídos.
5. Comissão em percentual vai até 100%.

## Permissões
Ver `docs/04-seguranca-permissoes.md` (papel `comercial` e permissões `comercial:*`). Admin e gestor gerenciam tudo; o papel `comercial` (vendedor) consulta o catálogo e, nas próximas entregas, registra as próprias vendas e vê os próprios números.

## Importação do catálogo
Os 12 produtos de 02/11/2026 ficam em `src/modulos/comercial/dados/catalogo-produtos.ts`. A migration `20261103030000_comercial_catalogo` foi gerada por `npx tsx scripts/gerar-sql-catalogo.ts` e usa `INSERT IGNORE` com ids fixos, então não duplica dados nem desfaz edições feitas na tela.

## Situação da implementação
**Entrega 1 (feito):** papel `comercial`, catálogo de produtos com ofertas e links, canais de venda e importação dos 12 produtos.

**Próximas:** entrega 2 (vendas), entrega 3 (metas) e entrega 4 (dashboard). Depois, cada uma com especificação própria: integração com o Kommo, parcelas e MRR, e cálculo de comissão.
