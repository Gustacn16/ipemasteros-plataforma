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
- `/comercial` (Dashboard): tema escuro só nesta tela (fundo grafite #111416 com brilho roxo #5F45F4, cartões translúcidos). Filtros na URL: `mes=AAAA-MM` (padrão: atual), `produto`, `vendedor` (só para quem vê a equipe). Cartões: vendido no mês com variação contra o mês anterior (sem selo se o anterior for zero), vendas, ticket médio e % da meta (verde ≥ 100%, amarelo 70–99%, vermelho < 70%, "—" sem meta). Gráfico Vendido × Meta (Recharts) com 6M/12M e o resumo "R$ X em N meses · K de M bateram a meta". Cartão **Projeção de fechamento** logo abaixo dos números (desde 2026-11-19, regra em `regras/projecao.ts`): no mês em andamento mostra a projeção, o % da meta e quanto fica acima ou abaixo dela. A projeção principal é **pelos leads**: vendido até hoje + (leads que ainda devem chegar no mês, no ritmo de leads do mês) × conversão média × ticket médio. Conversão = vendas ÷ leads da Meta (formulário + site + conversas) nos 6 meses anteriores que têm leads; as vendas são de todos os canais, então a taxa vale como "vendas por lead". Ao lado vem a projeção **pelo ritmo de vendas** (vendido ÷ dias passados × dias do mês). Também mostra quanto falta vender, por dia até o fim do mês, leads no mês, conversão, ticket da base e quantos leads faltam para bater a meta. Sem `comercial:ver_marketing`, ou com filtro de produto ou vendedor, fica só o ritmo, porque os leads ainda não são ligados a produto nem vendedor. No mês fechado o cartão vira "Fechamento do mês"; no mês futuro não aparece. Ranking de vendedores (só admin e gestor), por produto, as 6 vendas mais recentes e o cartão "Funil do Kommo — em breve". O vendedor vê só os próprios números.
- **Visão Mídia** (`/comercial?visao=midia`, só com `comercial:ver_marketing`): seletor "Vendas | Mídia" no topo do dashboard. Cartões de investimento (com variação), leads (formulário · site · WhatsApp), custo por lead, CAC e ROAS; gráfico mensal de investimento × leads (6M/12M); tabela por campanha. Filtros na URL: `conta`, `campanhas` (lista separada por vírgula), `busca` (nome) e `situacao` (`ativas`/`pausadas`). Com filtro de campanha, CAC e ROAS mostram "—" (as vendas não são ligadas a campanhas). Antes de 2026-11, CAC e ROAS também ficam "—". Só contas ativas em BRL entram. **Por categoria** (pelo nome da campanha, nesta ordem): Paciente Modelo ("paciente modelo"), Psiquiatria ("psiq"), Pós Transplante Capilar ("TCT" ou "transplante") e Outras; cada cartão mostra investimento, leads, custo por lead, impressões, cliques no link, CTR (link), CPC (link) e visitas ao perfil (tipos de resultado com "profile_visit"); clicar filtra a tela (`?categoria=`). **Melhores criativos** (desde 2026-11-04): até 10 anúncios do mês com menor custo por lead, entre os que gastaram pelo menos R$ 50 (empate: mais leads), com miniatura, campanha, leads, gasto, CTR e CPC do link; respeita todos os filtros. Os números por anúncio vêm da importação (`CriativoAnuncio`, `MetricaDiariaCriativo`; histórico próprio desde 2026-01-01 via `historicoCriativosEm`; erro nos anúncios não desfaz as campanhas). A miniatura é a URL da Meta, que expira e é renovada a cada importação.
- `/comercial/vendas`: lista com filtros na URL (`periodo=semana|mes|mes_passado|intervalo` com `de`/`ate`, `produto`, `vendedor` só para quem vê a equipe, `canal`) e rodapé com quantidade e valor total. "Registrar venda" abre o formulário na ordem que a equipe já usava: produto, data, vendedor, data do lead, cliente, WhatsApp, canal, data de entrega, forma de pagamento (oferta, método, entrada, parcelas, valor da parcela, 1º vencimento e total ao vivo) e observações. Clicar numa venda abre a edição, ou só a leitura quando a pessoa não pode mais editar.
- `/comercial/produtos`: estante com uma prateleira por tipo (Pós-Graduação, Curso Livre, Paciente Modelo) e um cartão por produto (área, nome, preço e parcelas da oferta padrão, número de ofertas e links). Produto inativo aparece apagado, com borda tracejada. A lixeira no cartão aparece só para o admin. Filtros na URL: `busca` (nome), `tipo`, `area`, `situacao=ativos|inativos|todos`. Botão "+ Novo produto".
- `/comercial/produtos/[id]`: ofertas e preços, links, dados gerais, carga horária, comissão, descrição, ementa e observações. Ações "Desativar/Ativar" e "Excluir". O papel `comercial` vê a ficha só para leitura.
- `/comercial/metas` (visão, desde 2026-11-04): mês com "◀ ▶" (`?mes=AAAA-MM`), anel com o % da meta do mês (verde ≥ 100%, âmbar 70–99%, vermelho < 70%), cartões de meta, vendido, falta vender e vendas, gráfico vendido × meta por vendedor, pódio dos 3 maiores % e um cartão por vendedor com foto (o seu marcado "Você"). Quem não vê a equipe vê só o próprio cartão.
- `/comercial/metas/cadastro` (só quem gerencia metas): total do mês e "Copiar do mês anterior". Um cartão por produto, nas prateleiras da estante, com uma linha por vendedor (valor em R$ e quantidade), total do produto e "Salvar". No fim, o total por vendedor. Deixar valor e quantidade vazios apaga a meta.
- `/comercial/integracao-meta` (só admin): situação da conexão com a Meta, contas de anúncio (liga/desliga na importação; moeda diferente de BRL fica fora dos totais), últimas 10 importações e "Atualizar agora". Configuração em `docs/runbooks/meta-ads.md`.
- `/comercial/canais`: lista de canais de venda (adicionar, renomear e ativar/desativar).
- `/comercial/vendas/importar` (só admin, link na tela de Vendas): importa o histórico da plataforma antiga (Lovable). Ver "Histórico da plataforma antiga" abaixo.

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

## Histórico da plataforma antiga (Lovable)
A exportação de 18/11/2026 (pacote `dados-comerciais-ipemaster-2026-11-18.zip`, com guia próprio) tem 80 vendas de 10/06 a 15/11/2026 (R$ 2.158.268,92) e 43 metas por vendedor. O arquivo **não vai para o Git** (tem dados de clientes): o admin envia o `dados-comerciais.json` em `/comercial/vendas/importar`, confere a prévia (só contagens, valores por mês e nomes de vendedores) e grava. A tela recorta do arquivo, no navegador, só as tabelas usadas. Código em `src/modulos/comercial/importacao-lovable/` (regras puras e testes) e `servicos/importacao-lovable.ts`. Auditoria `vendas.importadas`, só com contagens.

| Plataforma antiga | Sistema novo |
|---|---|
| `sales.id` | `Venda.id` = `lovable-<id antigo>` (é isso que impede duplicar) |
| `sale_date`, `lead_entry_date`, `delivery_date`, `first_due_date` | `dataVenda`, `dataEntradaLead`, `dataEntrega`, `primeiroVencimento` |
| `product_id` | `produtoId`, pelo nome do produto antigo no catálogo (os 12 são os mesmos). As vendas "Pós-Graduação em Psiquiatria" apontam para a EAD. Produto excluído na tela que tem venda ou meta antiga (no teste: Tratamento Capilar, Transplante de Barba e Master FUE) volta como **inativo**, porque produto com venda não pode ficar excluído (regra 3) |
| `seller_id` / `created_by` (= `profiles.user_id`) | `vendedorId` / `criadoPorId`, pelo nome ou apelido do usuário, nesta ordem: igual; igual sem espaços ("PedroPrado"); todas as palavras do antigo no novo; todas as palavras do novo no antigo ("Luisa" ↔ "Luisa Santos"). Empate não casa. Sem usuário: cria um vendedor **inativo**, sem senha, id `lovable-<user_id>`, e-mail `…@historico.invalid`, cargo "Vendedor (plataforma antiga)" |
| `customer_name`, `whatsapp` | `nomeCliente`, `whatsappCliente` (só dígitos, sem o 55; fora de 10–11 dígitos fica vazio) |
| `channel` | `canalId`, pelo nome sem acento e maiúscula; o que falta é criado (Meta Ads, Orgânico, Indicação, ChatGPT Ads) |
| `payment_method` | Pix → `pix`, Boleto → `boleto`, Cartão de Crédito → `cartao`. Vazio (4 vendas) → `pix` com a observação "Forma de pagamento não informada na plataforma antiga." |
| `down_payment`, `installments_count`, `installment_value` | `entrada`, `numeroParcelas`, `valorParcela`; `valorTotal` recalculado (regra 6). Bateu com `value` nas 80 |
| `notes`, `next_actions` | `observacoes`, `proximosPassos` |
| `status` = cancelada | não entra (nenhuma na exportação) |
| `sales_seller_product_targets` | `MetaVenda` (id `lovable-<id>`): `quantidadeAlvo` = `sales_count`; `valorAlvo` = quantidade × `ticket_override` ou, sem ele, × o preço da oferta padrão (igual às metas do sistema). Meta zerada não entra; meta que já existe no mês, produto e vendedor fica como está |

Regras: venda já importada (mesmo id, inclusive excluída depois) é pulada; venda registrada direto no sistema com o mesmo produto, dia e nome do cliente também é pulada, para não contar duas vezes. Duas vendas têm a data do lead depois da data da venda e foram mantidas como vieram.

**Não importado** (sem lugar no Comercial hoje): `sales_installments` (805 parcelas, todas pendentes: ficam para a entrega de parcelas e MRR), `product_monthly_targets` e `sales_team_targets` (metas sem vendedor ou só em R$; a meta do produto é a soma das metas por vendedor), `media_metrics` e `funnel_metrics` (lançamentos manuais; a mídia vem da Meta), remuneração (`compensation_*`), `students` (Acadêmico), indicadores (`indicator_*`, `kpi_*`) e diagramas de funil.

Os filtros de vendedor e de produto do dashboard e da lista de vendas mostram também quem já vendeu e está inativo e os produtos inativos com venda ou meta (`listarVendedoresDoFiltro`, `listarProdutosDoFiltro`).

## Situação da implementação
**Entrega 1 (feito):** papel `comercial`, catálogo de produtos com ofertas e links (estante de cartões), canais de venda e importação dos 12 produtos.

**Entrega 2 (feito):** registro de vendas, lista com filtros e total, edição, exclusão e auditoria.

**Entrega 3 (feito):** metas do mês por produto e vendedor, com totais e cópia do mês anterior.

**Entrega 4 (feito):** dashboard escuro com números do mês, gráfico, ranking, por produto e vendas recentes.

**Meta Ads, entrega 1 (feito):** importação diária (4h, refaz os últimos 7 dias; a primeira carga vai desde 2026-01-01) e manual, pela chave de um usuário do sistema (`META_ACCESS_TOKEN`), via `GET /api/cron/importar-meta-ads`. Leads = formulário da Meta + site (pixel) + conversas iniciadas. Spec: `docs/superpowers/specs/2026-11-02-meta-ads-design.md`. Entrega 3 (feito em 2026-11-04): visão Mídia no dashboard, com filtros de campanha. Próxima: atribuição de campanhas a produtos (entrega 2), que libera o filtro por produto na mídia.

**Comissões (2026-11-17):** aba `/comercial/comissoes`. A comissão sai das vendas registradas no mês: por produto, R$ fixo por venda ou % do valor total do contrato. Quem bate a meta (em quantidade) do produto no mês ganha o "bônus meta" em todas as vendas desse produto; senão, vale a base (regra em `regras/comissao.ts`). Cada vendedor tem "ver cálculo". Quem gerencia produtos edita a tabela "Comissão por produto" na mesma aba.

**Próximas, cada uma com especificação própria:** integração com o Kommo (funil de leads) e parcelas e MRR dos alunos.
