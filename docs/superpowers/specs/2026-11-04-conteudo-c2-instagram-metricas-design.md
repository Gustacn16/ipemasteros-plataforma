# Conteúdo C2a — Métricas do Instagram: especificação

- **Status:** Proposto
- **Data:** 2026-11-04
- **Base:** `docs/superpowers/specs/2026-11-02-conteudo-c1-design.md` (seção 9), `docs/modulos/conteudo.md`, `docs/superpowers/specs/2026-11-02-meta-ads-design.md` (mesmo app, mesma chave e mesmo padrão de importação) e `docs/02-arquitetura.md` (jobs por cron). Onde divergir deles, vale este documento, e os docs afetados são atualizados na implementação.
- **Próxima etapa (spec própria):** C2b, publicação agendada no Instagram. Depende da ADR de storage de mídia.

## 1. Objetivo
Trazer para o módulo Conteúdo, sem digitação, os números do Instagram da IPEMaster: os de cada post e story e os da conta (seguidores, alcance, visitas ao perfil).

Critério de sucesso: de manhã, a equipe abre o Conteúdo e vê os números do mês do perfil, comparados com os do mês anterior, e em **Publicados** todos os posts e stories do mês com os números do dia anterior. Os que foram planejados aparecem ligados ao conteúdo, sem ninguém ter preenchido nada.

## 2. Escopo
**Entra:** leitura do perfil da IPEMaster (posts de feed, carrosséis, reels e stories, desde 2026-01-01); números por post e por story; números diários e mensais da conta; seguidores anotados uma vez por dia; ligação automática e manual entre um post e a publicação de um conteúdo; atualização diária, de hora em hora (stories) e manual; tela da integração; runbook.

**Fica de fora:** publicar ou agendar (C2b); comentários e mensagens (inbox); dados demográficos do público; perfil do Pedro Prado (fica manual; o desenho aceita outras contas sem mudança de modelo); Facebook, YouTube e TikTok; números de anúncios impulsionados (`total_*` da Meta); dados de cada foto dentro de um carrossel.

## 3. Decisões
| Decisão | Escolha | Motivo |
|---|---|---|
| Acesso | A mesma chave do usuário do sistema do Meta Ads (`META_ACCESS_TOKEN`), na Graph API `graph.facebook.com`, com as permissões `instagram_basic`, `instagram_manage_insights`, `pages_show_list` e `pages_read_engagement` | O usuário marcou todas as permissões ao gerar a chave. A chave de usuário do sistema não expira e dispensa a revisão do app, porque só lê ativos do próprio portfólio. Se faltar permissão, a tela da integração diz qual |
| Onde guardar os posts | Tabela própria (`MidiaInstagram`), ligada opcionalmente a uma `Publicacao` | Posts de fora do planejamento entram nos totais sem encher o quadro de Planejamento e o Calendário |
| Posts de fora do planejamento | Todos são importados e marcados "fora do planejamento" | Os totais do mês batem com o Instagram |
| Histórico | Posts e números da conta desde 2026-01-01 | Mesmo início do Meta Ads |
| Frequência | Diária às 4h (São Paulo) e, só para os stories, de hora em hora; "Atualizar agora" para o admin | Os números da Meta podem demorar até 48 h; os stories só têm números enquanto estão no ar (24 h) |
| Stories | Capturados de hora em hora por cron, guardando a última leitura | Webhooks de insights exigiriam endpoint público, assinatura do app e modo ao vivo. O cron reaproveita o que já existe |
| Seguidores | Total anotado uma vez por dia a partir da ligação; ganhos e perdas do mês pela métrica `follows_and_unfollows` | A Meta não entrega mais o histórico do total de seguidores |
| Visitas ao perfil | Soma de `profile_visits` dos posts e stories do mês, mais `profile_links_taps` da conta (cliques no link da bio) | A Meta não entrega mais visitas ao perfil no nível da conta; os reels não têm essa métrica |
| Nomes | "Visualizações" no lugar de "impressões" | `impressions` foi desativada pela Meta em 2025 |
| Cliente da Graph API | A base (pedido, paginação, erros, `VERSAO_GRAPH`) sai de `src/modulos/comercial/servicos/meta-graph.ts` e vai para `src/lib/meta-graph.ts`, usada pelo Comercial e pelo Conteúdo | Os módulos não importam serviços uns dos outros (`docs/02-arquitetura.md`); uma versão única da Graph API |

## 4. Modelo de dados
Convenções do projeto: ids `cuid`, `criadoEm`/`atualizadoEm`, tabelas `snake_case` no plural, datas em UTC. Os números são `Int?`, e `null` quer dizer "a Meta não informou", que é diferente de 0.

| Modelo | Campos | Observações |
|---|---|---|
| `ContaInstagram` | id, idExterno (id da conta profissional, único), usuario (@, ≤60), nome (≤100)?, paginaId (≤40)?, fotoUrl (≤1000)?, canalId (único)?, ativa (bool, padrão true) | Contas que a chave enxerga. `canalId` liga a conta a um `Canal` de plataforma `instagram`. Só contas `ativa` e com canal são importadas |
| `MidiaInstagram` | id, contaId, idExterno (único), tipo (`post`/`carrossel`/`reels`/`story`), legenda (Text)?, permalink (≤500), codigo (≤40), miniaturaUrl (≤1000)?, publicadoEm, alcance, visualizacoes, curtidas, comentarios, salvamentos, compartilhamentos, interacoes, visitasPerfil, respostas, metricasEm?, publicacaoId (único)?, removidaEm? | Um post ou story. `codigo` é o trecho do link (`/p/<codigo>/`, `/reel/<codigo>/`), usado na ligação. `removidaEm` é preenchido quando o post some da conta. Índices: (contaId, publicadoEm), (codigo) |
| `MetricaContaInstagram` | id, contaId, periodo (`dia`/`mes`), data (`@db.Date`; no mês, o dia 1), alcance, visualizacoes, interacoes, curtidas, comentarios, salvamentos, compartilhamentos, cliquesLink, novosSeguidores, deixaramDeSeguir, seguidores | Único por (contaId, periodo, data). `seguidores` só nas linhas de dia e só a partir da ligação. A linha do mês existe porque o alcance do mês (pessoas únicas) não é a soma do alcance dos dias |
| `AtualizacaoInstagram` | id, tipo (`completa`/`stories`), origem (`agendada`/`manual`), status (`em_andamento`/`concluida`/`falhou`), iniciadoEm, finalizadoEm?, registros (int), erro (Text)?, iniciadaPorId? | Histórico. Nunca guarda a chave |

**`Publicacao` (já existe):** ganha `metricasOrigem` (`manual`/`instagram`, padrão `manual`). Os campos de números continuam lá. Quando há um post ligado, eles são copiados do post a cada atualização, e as telas da C1 continuam funcionando sem mudança.

## 5. Regras de negócio
1. **Contas:** `GET /me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}` com paginação. Upsert por `idExterno`, sem mexer em `canalId` nem em `ativa`. Página sem conta do Instagram é ignorada.
2. **Ligar conta e canal:** na tela da integração, o admin escolhe, para cada conta, um `Canal` ativo de plataforma `instagram`. Um canal só pode estar ligado a uma conta.
3. **Posts:** `GET /{conta}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url&limit=100`, paginando até passar de 2026-01-01. O tipo sai de `media_product_type` e `media_type`: `REELS` → `reels`; `FEED` + `CAROUSEL_ALBUM` → `carrossel`; `FEED` + outro → `post`. A miniatura é `thumbnail_url` nos vídeos e `media_url` nas fotos. Upsert por `idExterno`.
4. **Stories:** `GET /{conta}/stories` com os mesmos campos (tipo `story`). Só os que estão no ar aparecem: quando um story sai, a última leitura fica guardada.
5. **Números de cada post:** `GET /{midia}/insights?metric=…`, com estas métricas por tipo:
   - post e carrossel: `reach, views, likes, comments, saved, shares, total_interactions, profile_visits`
   - reels: `reach, views, likes, comments, saved, shares, total_interactions`
   - story: `reach, views, shares, total_interactions, profile_visits, replies`

   Métrica ausente ou com lista vazia vale `null`. No story, o erro de código 10 (valor abaixo de 5) também vale `null` e não conta como falha.
6. **Números da conta:** `GET /{conta}/insights?metric=reach,views,total_interactions,likes,comments,saves,shares,profile_links_taps,follows_and_unfollows&period=day&metric_type=total_value` com `since`/`until`, uma chamada por dia (linhas `dia`) e uma por mês (linha `mes`, do dia 1 até o fim do mês ou até ontem). `follows_and_unfollows` usa a divisão `follow_type` para preencher `novosSeguidores` e `deixaramDeSeguir`. O total de seguidores vem de `GET /{conta}?fields=followers_count` e é gravado na linha do dia de hoje (horário de São Paulo).
7. **Atualização completa** (cron diário e "Atualizar agora"): contas; posts novos; números dos posts publicados nos últimos 30 dias; linhas `dia` dos últimos 7 dias até ontem; linha `mes` do mês atual e, até o dia 3, também a do mês anterior; seguidores de hoje; stories no ar. A **primeira** atualização (conta sem nenhum post no banco) traz os posts e os números de todos eles desde 2026-01-01, as linhas `dia` desde 2026-01-01 e as linhas `mes` de janeiro até o mês atual. "Atualizar agora" também refaz os números de todos os posts desde 2026-01-01, e não só os dos últimos 30 dias.
8. **Atualização de stories** (cron de hora em hora): só os stories no ar, com os números deles.
9. **Uma por vez:** cada tipo (`completa` e `stories`) tem a sua trava. Se houver uma `em_andamento` do mesmo tipo iniciada há menos de 30 minutos, a nova é recusada ("Já existe uma atualização em andamento."). Depois disso, a antiga é marcada como `falhou` ("Interrompida").
10. **Idempotência:** tudo é upsert. Rodar duas vezes dá o mesmo resultado.
11. **Post removido:** se um post publicado nos últimos 30 dias deixa de aparecer na listagem da conta, `removidaEm` é preenchido, e o post sai dos totais e de Publicados. A ligação com a publicação é mantida.
12. **Ligação automática:** depois de cada atualização, o post sem ligação procura uma `Publicacao` sem post ligado, no canal da conta, cuja `url` contenha o seu `codigo`, de um conteúdo em `aprovado` ou `publicado`. Se achar exatamente uma, os dois são ligados.
13. **Ligação manual** ("Ligar a um conteúdo", com `conteudo:usar`): a lista mostra os conteúdos da mesma conta (`Marca`), em `aprovado` ou `publicado`, que têm uma publicação nesse canal sem post ligado, ordenados pela data de publicação mais próxima da data do post. "Desligar" desfaz a ligação, volta `metricasOrigem` para `manual`, mantém os números como estavam e marca o post (`desligadaEm`) para a ligação automática não refazê-la; uma nova ligação manual limpa a marca.
14. **Efeito da ligação:** a `Publicacao` passa para `publicado`, com `url` = permalink, `publicadoEm` = data do post, `metricasOrigem = instagram` e os números copiados do post. Depois disso vale a regra da C1: com todos os canais publicados, o conteúdo vai para `publicado`. Com `metricasOrigem = instagram`, os números não podem ser editados à mão.
15. **Erros da Meta**, em português, guardados na atualização: os mesmos do Meta Ads (190: chave inválida; 10/200: sem permissão; 4/17/32/613/80002: limite de uso; outros: "Erro da Meta: <mensagem>"), mais "Nenhuma conta do Instagram encontrada. Confira se o usuário do sistema recebeu a Página e a conta do Instagram." Um post que falha não impede os outros: a atualização termina `concluida`, com o aviso "N posts sem números nesta atualização".
16. **Permissões da chave:** a tela da integração consulta `GET /me/permissions` e lista, em português, as permissões da seção 3 que faltam. Isso não bloqueia a atualização: a Meta devolve o erro, e ele aparece no histórico.
17. **Totais do mês** (bloco Instagram, mês do seletor, horário de São Paulo):
    - **Alcance, visualizações, interações, cliques no link da bio, novos seguidores e deixaram de seguir:** da linha `mes`.
    - **Seguidores:** o último total anotado no mês, mais a diferença para o último total do mês anterior (ou "—" se não houver).
    - **Visitas ao perfil:** soma de `visitasPerfil` dos posts e stories publicados no mês, com a observação "vindas dos posts e stories".
    - **Variação** contra o mês anterior em todos os cartões. Divisor zero ou ausente mostra "—".
18. **Atualizado em:** o bloco mostra "Dados do Instagram atualizados em DD/MM às HH:MM", da última atualização `completa` `concluida`. Se nenhuma conta estiver ligada a um canal, mostra "Instagram não conectado", com um link para a tela da integração (só para quem tem a permissão).

## 6. Permissões
| Permissão | admin | gestor | colaborador |
|---|---|---|---|
| Ver os números e ligar ou desligar posts (`conteudo:usar`, já existe) | ✅ | ✅ | ✅ |
| `conteudo:gerenciar_integracao_instagram` (tela da integração, ligar conta a canal, "Atualizar agora") | ✅ | — | — |

As rotas de cron usam o mesmo `CRON_SECRET`, com comparação em tempo constante (`src/lib/cron.ts`).

**Auditoria:** nada aqui envolve dado pessoal. A ligação entre post e publicação fica registrada no próprio post e o histórico fica nas atualizações, e não no log de auditoria.

## 7. Telas
As telas usam as peças compartilhadas de `src/componentes/` (`CabecalhoPagina`, `CartaoNumero`, `ChipSituacao`, `EstadoVazio`) e os tokens do tema, seguindo a renovação visual do Conteúdo feita em 2026-11-04.

| Rota | Conteúdo |
|---|---|
| `/conteudo` (início) | Bloco "Instagram" com cartões do mês (seguidores, alcance, visualizações, interações, visitas ao perfil, cliques no link da bio), cada um com a variação; gráfico de seguidores dia a dia no mês; "atualizados em". Aparece quando o filtro de conta inclui uma conta com Instagram ligado |
| `/conteudo/publicados` | Lista de todos os posts e stories do mês das contas ligadas (miniatura, tipo, data, alcance, visualizações, interações, salvamentos, compartilhamentos, link para o Instagram), junto com as publicações manuais dos outros canais, como hoje. Selo "fora do planejamento" com o botão "Ligar a um conteúdo"; nos ligados, o título do conteúdo com link. Ordenação por data, alcance ou interações. Se a miniatura não carregar (o link da Meta expira), aparece o ícone do tipo |
| `/conteudo/itens/[id]` | Na publicação do Instagram ligada a um post: números com o selo "do Instagram", sem edição, link do post e "Desligar" |
| `/conteudo/integracao-instagram` | Com `conteudo:gerenciar_integracao_instagram`. Situação ("Conectada", "Falta permissão: …", "Não configurada"), contas encontradas (foto, @, nome, canal ligado, ativa), últimas 10 atualizações (data, tipo, origem, registros, erro), "Atualizar agora" e link para o runbook. Entrada no menu de configurações do Conteúdo |

## 8. Configuração (passo a passo para o usuário)
Documento `docs/runbooks/instagram.md`, para seguir com o Claude, um passo por vez. A chave nunca passa pelo chat.
1. Conferir que o Instagram da IPEMaster é conta profissional e está ligado a uma Página do Facebook do portfólio da IPEMaster.
2. No portfólio (business.facebook.com/settings) → Usuários do sistema → `IPEMaster OS` → **Atribuir ativos**: a **Página** e a **conta do Instagram** da IPEMaster, com acesso total ou, no mínimo, acesso a conteúdo e insights.
3. Abrir **Conteúdo → Integração Instagram** e conferir a situação. Se faltar permissão, gerar uma nova chave do mesmo usuário do sistema com `ads_read` e as permissões da seção 3 e trocar `META_ACCESS_TOKEN` na Hostinger (o Meta Ads continua funcionando com a nova chave). Depois, uma nova publicação para valer.
4. Ligar a conta ao canal "Instagram" da IPEMaster e clicar em "Atualizar agora" para a primeira carga.
5. Criar no hPanel, pelo próprio usuário, os dois crons (o horário do servidor é UTC, como no Meta Ads):
   ```
   0 7 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/importar-instagram
   5 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/importar-stories-instagram
   ```

## 9. Entregas
Cada entrega é publicada na branch `teste` e validada pelo usuário antes da seguinte:
1. **Conexão e importação:** cliente base da Graph API em `src/lib`, permissão nova, modelos e migration, cliente do Instagram, atualização completa e de stories, rotas de cron, ligação automática, tela da integração, ligação conta ↔ canal e runbook. Termina com a configuração feita pelo usuário e a primeira carga.
2. **Telas:** bloco Instagram no início, Publicados com todos os posts e stories, ligação manual e números no detalhe do conteúdo. Atualização de `docs/modulos/conteudo.md` e `docs/02-arquitetura.md`.

## 10. Testes
- **Vitest (regras puras):** tipo a partir de `media_type`/`media_product_type`; `codigo` a partir de permalinks (`/p/`, `/reel/`, `/tv/`, com e sem barra final e parâmetros); leitura das insights (métrica ausente, lista vazia, `total_value` e `values`, `follow_type`); erro 10 no story vale `null`; períodos (últimos 30 dias de posts; 7 dias de linhas `dia`; mês atual e mês anterior até o dia 3; carga inicial desde 2026-01-01; virada de mês e ano no fuso de São Paulo); escolha da ligação automática (nenhuma, uma, mais de uma, conteúdo não aprovado); totais e variações do mês com divisor zero; trava de 30 minutos por tipo; mapeamento de erros; matriz da nova permissão.
- **Cliente do Instagram:** respostas gravadas, sem rede: paginação de posts parando em 2026-01-01, conta sem Instagram, erro de um post sem derrubar os outros e lista de permissões.
- **Base da Graph API:** os testes atuais de `meta-graph.test.ts` continuam passando depois da extração.
- **Homologação:** roteiro passo a passo para o usuário a cada entrega, conferindo 3 posts contra o aplicativo do Instagram.

## 11. Riscos
- **Métricas que mudam:** a Meta marca várias métricas como "em desenvolvimento" e já desativou `impressions`. A lista de métricas fica num lugar só, a métrica que vier com erro vira `null` sem derrubar a atualização, e o runbook lembra de revisar a versão da Graph API uma vez por ano.
- **Limite de período nas insights da conta:** se a Meta recusar `since`/`until` de um mês inteiro, a linha `mes` usa o maior período aceito, e o cartão de alcance mostra a observação "aproximado". Isso é conferido na primeira carga real (entrega 1).
- **Limite de uso:** a primeira carga faz uma chamada por post (centenas). Se a Meta limitar, a atualização para com o erro de limite e a próxima continua de onde parou, porque os posts já gravados sem `metricasEm` entram na fila primeiro.
- **Story perdido:** se o cron de hora em hora falhar por mais de 24 h, os números daqueles stories não voltam mais. A tela da integração mostra a última atualização de stories concluída.
- **Miniaturas:** os links de imagem da Meta expiram. Eles são renovados a cada atualização dos últimos 30 dias, e os antigos podem cair para o ícone do tipo.
