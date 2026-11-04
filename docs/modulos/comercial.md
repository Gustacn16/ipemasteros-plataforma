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
| `Venda` | id, produtoId, ofertaId?, vendedorId, dataVenda, dataEntradaLead?, nomeCliente, whatsappCliente? (só dígitos, sem o 55), canalId?, dataEntrega?, metodoPagamento (`pix`/`cartao`/`boleto`/`transferencia`), entrada, numeroParcelas, valorParcela, primeiroVencimento?, valorTotal, observacoes?, criadoPorId, excluidoEm |
| `MetaVenda` | id, mes (dia 1), produtoId, vendedorId, valorAlvo, quantidadeAlvo. Única por mês, produto e vendedor; a meta do produto no mês é a soma das metas dos vendedores |
| `ContaAnuncio` | id, idExterno (`act_…`), nome, moeda, ativa (entra ou não na importação) |
| `CampanhaAnuncio` | id, contaId, idExterno, nome, status, objetivo, atribuicao (`produto`/`institucional`/`sem_produto`), produtoId? |
| `MetricaDiariaAnuncio` | campanha e dia: investimento, impressões, alcance, cliques, leadsFormulario, leadsSite, conversasIniciadas (único por campanha e dia) |
| `ImportacaoAnuncios` | histórico: origem (`agendada`/`manual`), status, período, registros e erro (nunca a chave) |

O catálogo é **único no sistema**: o Acadêmico vai usar os mesmos produtos (o `Curso` de `academico.md` passa a ser o `Produto`). Dinheiro em `Decimal(12,2)`; entre servidor e tela trafega como string `"3300.00"` (`src/lib/dinheiro.ts`).

## Telas
- `/comercial` (Dashboard): tema escuro só nesta tela (fundo grafite #111416 com brilho roxo #5F45F4, cartões translúcidos). Filtros na URL: `mes=AAAA-MM` (padrão: atual), `produto`, `vendedor` (só para quem vê a equipe). Cartões: vendido no mês com variação contra o mês anterior (sem selo se o anterior for zero), vendas, ticket médio e % da meta (verde ≥ 100%, amarelo 70–99%, vermelho < 70%, "—" sem meta). Gráfico Vendido × Meta (Recharts) com 6M/12M e o resumo "R$ X em N meses · K de M bateram a meta". Ranking de vendedores (só admin e gestor), por produto, as 6 vendas mais recentes e o cartão "Funil do Kommo — em breve". O vendedor vê só os próprios números.
- **Visão Mídia** (`/comercial?visao=midia`, só com `comercial:ver_marketing`): seletor "Vendas | Mídia" no topo do dashboard. Cartões de investimento (com variação), leads (formulário · site · WhatsApp), custo por lead, CAC e ROAS; gráfico mensal de investimento × leads (6M/12M); tabela por campanha. Filtros na URL: `conta`, `campanhas` (lista separada por vírgula), `busca` (nome) e `situacao` (`ativas`/`pausadas`). Com filtro de campanha, CAC e ROAS mostram "—" (as vendas não são ligadas a campanhas). Antes de 2026-11, CAC e ROAS também ficam "—". Só contas ativas em BRL entram.
- `/comercial/vendas`: lista com filtros na URL (`periodo=semana|mes|mes_passado|intervalo` com `de`/`ate`, `produto`, `vendedor` só para quem vê a equipe, `canal`) e rodapé com quantidade e valor total. "Registrar venda" abre o formulário na ordem que a equipe já usava: produto, data, vendedor, data do lead, cliente, WhatsApp, canal, data de entrega, forma de pagamento (oferta, método, entrada, parcelas, valor da parcela, 1º vencimento e total ao vivo) e observações. Clicar numa venda abre a edição, ou só a leitura quando a pessoa não pode mais editar.
- `/comercial/produtos`: estante com uma prateleira por tipo (Pós-Graduação, Curso Livre, Paciente Modelo) e um cartão por produto (área, nome, preço e parcelas da oferta padrão, número de ofertas e links). Produto inativo aparece apagado, com borda tracejada. A lixeira no cartão aparece só para o admin. Filtros na URL: `busca` (nome), `tipo`, `area`, `situacao=ativos|inativos|todos`. Botão "+ Novo produto".
- `/comercial/produtos/[id]`: ofertas e preços, links, dados gerais, carga horária, comissão, descrição, ementa e observações. Ações "Desativar/Ativar" e "Excluir". O papel `comercial` vê a ficha só para leitura.
- `/comercial/metas`: mês escolhido com "◀ ▶" (`?mes=AAAA-MM`, padrão: mês atual), total do mês e "Copiar do mês anterior". Um cartão por produto, nas prateleiras da estante, com uma linha por vendedor (valor em R$ e quantidade), total do produto e "Salvar". No fim, o total por vendedor. Deixar valor e quantidade vazios apaga a meta. Quem não gerencia metas vê só as próprias, sem editar.
- `/comercial/integracao-meta` (só admin): situação da conexão com a Meta, contas de anúncio (liga/desliga na importação; moeda diferente de BRL fica fora dos totais), últimas 10 importações e "Atualizar agora". Configuração em `docs/runbooks/meta-ads.md`.
- `/comercial/canais`: lista de canais de venda (adicionar, renomear e ativar/desativar).

## Regras de negócio
1. A primeira oferta de um produto vira a padrão. Marcar outra como padrão desmarca as demais. Excluir a padrão passa a marca para a primeira oferta restante.
2. Produto inativo ou excluído some dos campos de escolha, mas continua nas vendas e metas antigas.
3. Só o admin exclui produto (`comercial:excluir_produtos`), e só se ele nunca teve venda (nem excluída) nem meta; senão, o sistema orienta a desativar. A exclusão é lógica (`excluidoEm`).
4. SKU é normalizado em maiúsculas e não pode repetir entre produtos não excluídos.
5. Comissão em percentual vai até 100%.
6. **Venda:** o valor total é sempre `entrada + parcelas × valor da parcela`, recalculado no servidor (em centavos).
7. Escolher produto e oferta preenche o pagamento: à vista, a entrada é o preço inteiro; parcelado, a entrada é a matrícula e o valor da parcela é o da oferta ou, se ele for 0, `(preço − matrícula) ÷ parcelas`. Tudo pode ser alterado.
8. Vendedor é um usuário ativo com papel `comercial`, `gestor` ou `admin`. O papel `comercial` só registra vendas em seu nome e edita ou exclui as próprias até 7 dias depois de registrar; admin e gestor, qualquer uma a qualquer tempo.
9. Criar, editar e excluir venda gera auditoria (`venda.criada`, `venda.editada`, `venda.excluida`) só com nomes de campos e valor total, nunca nome ou WhatsApp do cliente. Excluir é lógico.
10. A data em que o lead entrou não pode ser depois da data da venda. Produto e canal precisam estar ativos, exceto ao editar uma venda antiga sem trocá-los.
11. **Metas:** "Copiar do mês anterior" cria só as metas que ainda não existem no mês, com os valores do mês anterior, sem sobrescrever; produtos e vendedores inativos não são copiados. Produto desativado com meta no mês continua aparecendo naquele mês.

## Permissões
Ver `docs/04-seguranca-permissoes.md` (papel `comercial` e permissões `comercial:*`). Admin e gestor gerenciam tudo; o papel `comercial` (vendedor) consulta o catálogo e, nas próximas entregas, registra as próprias vendas e vê os próprios números.

## Importação do catálogo
Os 12 produtos de 02/11/2026 ficam em `src/modulos/comercial/dados/catalogo-produtos.ts`. A migration `20261103030000_comercial_catalogo` foi gerada por `npx tsx scripts/gerar-sql-catalogo.ts` e usa `INSERT IGNORE` com ids fixos, então não duplica dados nem desfaz edições feitas na tela.

## Situação da implementação
**Entrega 1 (feito):** papel `comercial`, catálogo de produtos com ofertas e links (estante de cartões), canais de venda e importação dos 12 produtos.

**Entrega 2 (feito):** registro de vendas, lista com filtros e total, edição, exclusão e auditoria.

**Entrega 3 (feito):** metas do mês por produto e vendedor, com totais e cópia do mês anterior.

**Entrega 4 (feito):** dashboard escuro com números do mês, gráfico, ranking, por produto e vendas recentes.

**Meta Ads, entrega 1 (feito):** importação diária (4h, refaz os últimos 7 dias; a primeira carga vai desde 2026-01-01) e manual, pela chave de um usuário do sistema (`META_ACCESS_TOKEN`), via `GET /api/cron/importar-meta-ads`. Leads = formulário da Meta + site (pixel) + conversas iniciadas. Spec: `docs/superpowers/specs/2026-11-02-meta-ads-design.md`. Entrega 3 (feito em 2026-11-04): visão Mídia no dashboard, com filtros de campanha. Próxima: atribuição de campanhas a produtos (entrega 2), que libera o filtro por produto na mídia.

**Próximas, cada uma com especificação própria:** integração com o Kommo (funil de leads), parcelas e MRR dos alunos, e cálculo de comissão.
