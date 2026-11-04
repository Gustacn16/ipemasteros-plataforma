# Comercial — Integração Meta Ads: especificação

- **Status:** Proposto
- **Data:** 2026-11-02
- **Base:** `docs/superpowers/specs/2026-11-02-comercial-design.md` (módulo Comercial, entregas 1–4 já no ar) e `docs/02-arquitetura.md` (jobs agendados por cron). Onde divergir deles, vale este documento, e os docs afetados são atualizados na implementação.

## 1. Objetivo
Mostrar no dashboard comercial quanto se investe em anúncios da Meta (Facebook e Instagram), quantos leads chegam e quanto custa cada lead e cada venda, por mês e por produto.

Critério de sucesso: depois de conectar a conta, o gestor abre o dashboard e vê, para o mês e para cada produto, o investimento, os leads, o custo por lead, o CAC e o ROAS, com os dados do dia anterior já atualizados de manhã.

## 2. Escopo
**Entra:** leitura das contas de anúncio, campanhas e números diários pela Marketing API; importação diária automática e manual; histórico de importações; atribuição manual de campanha a produto; indicadores de marketing no dashboard.

**Fica de fora:** criar, editar ou pausar anúncios; dados de conjuntos e anúncios individuais; dados pessoais dos leads (nome, telefone, e-mail); Google Ads e TikTok; atribuição multitoque; divisão de uma campanha entre vários produtos; conversão de moeda; Kommo (especificação própria).

## 3. Decisões
| Decisão | Escolha | Motivo |
|---|---|---|
| Acesso | Chave de um **usuário do sistema** do Business Manager da IPEMaster, com a permissão `ads_read`, ligada a um app da Meta criado pela IPEMaster | Não expira, não depende da senha de ninguém e dispensa a revisão do app pela Meta, porque só lê contas do próprio Business |
| Onde fica a chave | Variável de ambiente `META_ACCESS_TOKEN` na Hostinger, colocada pelo próprio usuário com o passo a passo | A chave nunca passa pelo chat, pelo código nem pelo banco |
| Atribuição campanha → produto | Manual, numa tela, uma vez por campanha | Os nomes das campanhas não seguem padrão |
| Lead | Soma de três resultados da Meta: formulário da própria Meta, cadastro no site (pixel) e conversa iniciada (WhatsApp/Direct, usada em Paciente Modelo), guardados separados | É como a IPEMaster capta hoje |
| Histórico | Importação inicial desde 2026-01-01 | Permite o gráfico de 12 meses |
| Frequência | Todo dia às 4h (São Paulo), refazendo os últimos 7 dias; botão "Atualizar agora" para o admin | A Meta ajusta números retroativamente |
| Moeda | Só BRL entra nas somas | Conversão de moeda fica para depois |

## 4. Modelo de dados
Convenções do projeto (ids `cuid`, `criadoEm`/`atualizadoEm`, tabelas `snake_case` no plural). Dinheiro em `Decimal(12,2)`.

| Modelo | Campos | Observações |
|---|---|---|
| `ContaAnuncio` | id, idExterno (ex.: `act_123`, único), nome, moeda (≤3), ativa (bool, padrão true) | Contas vistas pela chave. `ativa: false` não é importada |
| `CampanhaAnuncio` | id, contaId, idExterno (único), nome (≤255), status (`ACTIVE`, `PAUSED`…, ≤30), objetivo (≤60)?, atribuicao (`produto`/`institucional`/`sem_produto`, padrão `sem_produto`), produtoId? | `produtoId` só com `atribuicao = produto` |
| `MetricaDiariaAnuncio` | id, campanhaId, data (`@db.Date`), investimento, impressoes, alcance, cliques, leadsFormulario, leadsSite, conversasIniciadas | Único por (campanhaId, data); índice (data) |
| `ImportacaoAnuncios` | id, origem (`agendada`/`manual`), iniciadoEm, finalizadoEm?, status (`em_andamento`/`concluida`/`falhou`), desde (`@db.Date`), ate (`@db.Date`), registros (int), erro (Text)?, iniciadaPorId? | Histórico; nunca guarda a chave |

## 5. Regras de negócio
1. **Leitura da Meta:** contas em `GET /me/adaccounts` (campos `id,name,currency,account_status`); campanhas em `GET /{conta}/campaigns` (`id,name,status,objective`); números em `GET /{conta}/insights` com `level=campaign`, `time_increment=1`, `time_range` do período e `fields=campaign_id,spend,impressions,reach,clicks,actions`, seguindo a paginação. A versão da Graph API fica numa constante única, a mais recente estável no momento da implementação.
2. **Leads a partir de `actions`:** formulário = `onsite_conversion.lead_grouped`; site = `offsite_conversion.fb_pixel_lead`; conversas = `onsite_conversion.messaging_conversation_started_7d`. Outros tipos são ignorados, incluindo o agregado `lead`, para não contar em dobro. Campo ausente vale 0.
3. **Idempotência:** contas e campanhas fazem `upsert` por `idExterno` (sem mexer na atribuição já feita); os números do dia fazem `upsert` por (campanha, data). Rodar duas vezes o mesmo período dá o mesmo resultado.
4. **Períodos:** a importação agendada refaz de 7 dias atrás até ontem. A primeira importação (sem nenhuma métrica no banco) vai de 2026-01-01 até ontem, em blocos de 30 dias. A manual refaz os últimos 7 dias, ou o histórico todo se ainda não houver dados.
5. **Uma importação por vez:** se houver uma `em_andamento` iniciada há menos de 30 minutos, a nova é recusada com "Já existe uma importação em andamento.". Depois de 30 minutos, a antiga é marcada como `falhou` ("Interrompida").
6. **Erros da Meta** viram mensagens em português na importação: chave inválida ou expirada (código 190) → "A chave de acesso da Meta é inválida ou foi revogada."; sem permissão (10, 200) → "A chave não tem permissão para ler esta conta."; limite de uso (4, 17, 613, 80004) → "A Meta limitou as consultas. Tente de novo em alguns minutos."; outros → "Erro da Meta: <mensagem>". Sem `META_ACCESS_TOKEN` → "Integração não configurada.". Uma conta que falha não impede as outras.
7. **Moeda:** conta com moeda diferente de `BRL` é importada, mas fica fora das somas, e a tela da integração mostra o aviso "Moeda X: fora dos totais".
8. **Atribuição:** campanha nova entra como `sem_produto`. Escolher um produto ativo grava `atribuicao = produto`; "Institucional" grava `institucional` e limpa o produto. A atribuição vale para todo o histórico da campanha.
9. **Indicadores** (mesmos filtros de mês e produto do dashboard; o filtro de vendedor não se aplica ao investimento):
   - **Investimento** = soma de `investimento` do mês.
   - **Leads** = formulário + site + conversas.
   - **CPL** = investimento ÷ leads.
   - **CAC** = investimento ÷ quantidade de vendas do mês.
   - **ROAS** = vendido ÷ investimento, exibido como "4,2x".
   - Qualquer divisor zero mostra "—". Antes de 2026-11-01, quando ainda não havia vendas no sistema, CAC e ROAS aparecem como "—".
   - Com filtro de produto, só entram as campanhas atribuídas àquele produto. Sem filtro, entram todas, inclusive institucionais e sem produto.
   - Variação do investimento contra o mês anterior, como no vendido.
10. **Dashboard atualizado em:** o painel mostra "Dados da Meta atualizados em DD/MM às HH:MM" (horário de São Paulo, da última importação `concluida`), ou "Meta Ads não conectada" com um link para a tela da integração (só para o admin).

## 6. Permissões
Novas permissões em `src/lib/permissoes.ts`:

| Permissão | admin | gestor | comercial |
|---|---|---|---|
| `comercial:ver_marketing` (cartões de marketing, colunas por produto, tela de campanhas para consulta) | ✅ | ✅ | — |
| `comercial:atribuir_campanhas` | ✅ | ✅ | — |
| `comercial:gerenciar_integracao_meta` (tela da integração e "Atualizar agora") | ✅ | — | — |

Rotas de cron (`/api/cron/<tarefa>`) aceitam só o header `Authorization: Bearer <CRON_SECRET>`, comparado em tempo constante. Qualquer outra chamada recebe 401, sem detalhes.

**Auditoria:** "Atualizar agora" e mudança de atribuição não envolvem dado pessoal e ficam no histórico de importações, não no log de auditoria.

## 7. Telas
| Rota | Conteúdo |
|---|---|
| `/comercial/campanhas` | Aba "Campanhas" (com `comercial:ver_marketing`). Seletor de mês. Tabela de campanhas com conta, nome, status, investimento e leads do mês e a atribuição (seleção de produto ativo, "Institucional" ou "Sem produto"; só leitura sem `comercial:atribuir_campanhas`). Filtro "Só sem produto" e aviso "N campanhas sem produto" no topo |
| `/comercial/integracao-meta` | Com `comercial:gerenciar_integracao_meta`. Situação ("Conectada", "Chave inválida" ou "Não configurada"), contas encontradas (nome, id, moeda, ativa/inativa na importação), últimas 10 importações (data, origem, período, registros e erro) e "Atualizar agora". Link para o passo a passo de configuração |
| `/comercial` (Dashboard) | Faixa "Marketing" com os cartões Investimento, Leads (com a divisão por tipo), CPL, CAC e ROAS; terceira linha "Investimento" no gráfico Vendido × Meta; colunas investimento, leads, CPL, CAC e ROAS em "Por produto", mais a linha "Sem produto / institucional" quando não há filtro de produto; "Dados da Meta atualizados em…" — tudo só com `comercial:ver_marketing` |

## 8. Configuração (passo a passo para o usuário)
Documento `docs/runbooks/meta-ads.md`, para seguir com o Claude, um passo por vez:
1. Criar um app da Meta do tipo "Empresa" no Business Manager da IPEMaster.
2. Criar um usuário do sistema (Administrador) e atribuir a ele o app e as contas de anúncio, com acesso de leitura.
3. Gerar a chave do usuário do sistema para o app, com a permissão `ads_read`, sem data de expiração.
4. Colar a chave na Hostinger em `META_ACCESS_TOKEN` (painel do site → variáveis de ambiente). O usuário faz isso no painel, nunca no chat. Depois, uma nova publicação para valer.
5. Criar o cron diário das 4h pelo conector da Hostinger (com aprovação do usuário): `curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<domínio>/api/cron/importar-meta-ads`. Se `CRON_SECRET` não existir, gerar um valor forte e gravá-lo nas variáveis de ambiente.
6. Abrir a tela da integração e clicar em "Atualizar agora" para a primeira carga.

Homologação e produção usam a mesma chave (é só leitura), cada uma com o seu cron.

## 9. Entregas
Cada entrega é publicada na branch `teste` e validada pelo usuário antes da seguinte:
1. **Conexão e importação:** permissões, modelos e migration, cliente da Graph API, importação (agendada e manual), rota de cron, tela da integração e runbook. Termina com a configuração feita pelo usuário e a primeira carga.
2. **Atribuição:** tela de campanhas.
3. **Dashboard:** cartões de marketing, linha de investimento no gráfico, colunas por produto e "atualizados em".

## 10. Testes
- **Vitest:** leitura de `actions` (os três tipos, tipos ignorados, campo ausente); conversão de `spend` em centavos; montagem dos períodos (últimos 7 dias até ontem; carga inicial desde 2026-01-01 em blocos de 30 dias; virada de mês e ano); mapeamento de erros da Meta; CPL, CAC, ROAS e variação com divisor zero e o corte antes de 2026-11-01; regra de "uma importação por vez" (30 minutos); comparação do segredo do cron; matriz das novas permissões.
- **Cliente da Graph API:** testado com respostas gravadas (sem rede): paginação, erro por conta e conta em outra moeda.
- **Homologação:** roteiro passo a passo para o usuário a cada entrega.

## 11. Riscos
- **Mudança de versão da Graph API:** a Meta desativa versões antigas cerca de 2 anos depois. A versão fica numa constante única e o runbook lembra de revisá-la uma vez por ano.
- **Nomes de `actions` que mudam:** se a Meta renomear um tipo de lead, os leads caem para zero sem erro. A tela da integração mostra, da última importação, os tipos de `actions` recebidos que não foram contados, para facilitar o ajuste.
- **Segredo do cron no comando:** o comando do cron guarda o `CRON_SECRET` em texto no painel da Hostinger. Quem acessa o painel já acessa as variáveis de ambiente, então o risco não aumenta. O segredo pode ser trocado a qualquer momento.
- **CAC e ROAS distorcidos:** vendas registradas fora do sistema não entram. A regra de corte em 2026-11-01 e o "—" evitam números enganosos no histórico.

## 12. Mudanças de 2026-11-04 (pedidas pelo usuário)
- A entrega 3 virou uma **visão Mídia** própria no dashboard (seletor "Vendas | Mídia"), em vez de uma faixa de cartões na visão de vendas.
- **Filtros de campanha** na visão Mídia: conta de anúncio, uma ou mais campanhas, busca pelo nome e situação (ativas ou pausadas). Com filtro de campanha, CAC e ROAS mostram "—".
- A entrega 2 (atribuição a produto) foi adiada; até lá, a tabela da visão Mídia é por campanha e o filtro por produto não vale para a mídia.
- Plano: `docs/superpowers/plans/2026-11-04-meta-ads-3-dashboard-midia.md`.
