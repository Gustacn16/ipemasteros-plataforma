# Módulo: Dashboard

> **Fase F6, a última.** Este doc define o alvo. Os detalhes das integrações serão refinados antes da implementação.

## Objetivo
Dar à gestão uma visão única de **quanto se investe em mídia (Meta Ads)**, **quanto se vende (Kommo)** e **como os leads convertem**, por curso, campanha e período.

## Fontes de dados
| Fonte | O que traz | Como |
|---|---|---|
| **Meta Ads** (Marketing API) | Campanhas, conjuntos, gasto, impressões, alcance, cliques, leads, CPL | Job diário importa os últimos 7 dias (dados da Meta mudam retroativamente) |
| **Kommo** (CRM) | Leads, funil e etapas, negócios ganhos e perdidos, valor, origem (UTM), curso de interesse | Webhooks para eventos em tempo real + job de hora em hora para reconciliar |

## Entidades
| Entidade | Campos principais |
|---|---|
| `ContaAnuncio` | id, plataforma (`meta`), idExterno, nome, moeda |
| `CampanhaAnuncio` | id, contaId, idExterno, nome, status, cursoId? (atribuição), objetivo |
| `MetricaDiariaAnuncio` | id, campanhaId, data, gasto (Decimal), impressoes, alcance, cliques, leads — único por (campanhaId, data) |
| `LeadKommo` | id, idExterno, criadoEmKommo, origem, utmSource, utmCampaign, cursoId?, etapaAtual, responsavelKommo |
| `NegocioKommo` | id, idExterno, leadId, cursoId?, valor (Decimal), status (`aberto`/`ganho`/`perdido`), motivoPerda?, fechadoEm? |
| `Meta` | id, cursoId?, periodo (mês), tipo (`vendas`/`receita`/`leads`/`investimento`), valorAlvo |
| `ExecucaoImportacao` | id, fonte, iniciadoEm, finalizadoEm, status, registros, erro? |

Os dados do Kommo guardam **o mínimo de dado pessoal**: idExterno e metadados comerciais, sem nome, telefone ou e-mail do lead. O dashboard trabalha com agregados.

## Indicadores
- Investimento total, por curso e por campanha
- Leads (Meta e Kommo), CPL = investimento ÷ leads
- Vendas (negócios ganhos), receita, ticket médio
- **Taxa de conversão** lead → venda, por etapa do funil
- **CAC** = investimento ÷ vendas · **ROAS** = receita ÷ investimento
- Realizado vs. meta do mês
- Tempo médio até a venda e principais motivos de perda

## Telas
- `/dashboard`: cartões de KPIs, filtro de período (padrão: mês atual vs. anterior) e de curso; gráfico de investimento × vendas por dia; funil de conversão; tabela por curso.
- `/dashboard/campanhas`: desempenho por campanha Meta com atribuição a curso.
- `/dashboard/metas`: cadastro de metas mensais.
- `/dashboard/atribuicao`: mapear campanhas Meta e valores de "curso" do Kommo para cursos do sistema.

## Regras de negócio
1. **Atribuição campanha → curso:** primeiro pela regra de nome (ex.: campanha contém o código do curso), depois por ajuste manual na tela de atribuição. Campanhas sem curso aparecem como "Não atribuído".
2. **Atribuição venda → curso:** por um campo personalizado do Kommo (a definir) mapeado para `Curso`.
3. Valores em BRL. Se a conta Meta usar outra moeda, a conversão precisa de decisão própria.
4. Importações são idempotentes (upsert por `idExterno` + data) e registram `ExecucaoImportacao`. O painel mostra "dados atualizados em …".
5. Só admin e gestor acessam o dashboard.

## Fora do escopo (v1)
Google Ads, TikTok Ads, atribuição multitoque, previsão de vendas.

## Dúvidas em aberto (resolver antes da F6)
- Quantas contas de anúncio Meta existem? Há acesso ao Business Manager para criar um usuário de sistema?
- No Kommo: quais funis, qual campo indica o curso, onde ficam as UTMs?
- A venda gera matrícula automaticamente no Acadêmico?
