# Módulo: Conteúdo

## Objetivo
Planejar, aprovar e acompanhar a produção de conteúdo dos canais da IPEMaster num calendário editorial e, quando a API do canal permitir, **publicar direto pelo sistema**.

Especificação da C1: `docs/superpowers/specs/2026-11-02-conteudo-c1-design.md`.

## Vocabulário
| Termo | No sistema |
|---|---|
| Conta (IPEMaster, Pedro Prado) | `Marca` |
| Plataforma da conta | `Canal` |
| Peça de conteúdo | `Conteudo` |
| Saída da peça num canal | `Publicacao` (status, link e métricas) |

## Entidades
| Entidade | Campos principais |
|---|---|
| `Marca` | id, nome, cor, ordem, excluidoEm |
| `Canal` | id, marcaId, plataforma (`instagram`/`youtube`/`tiktok`/`facebook`/`linkedin`/`newsletter`/`blog`/`podcast`/`outro`), identificador (@perfil), ativo, excluidoEm |
| `Conteudo` | id, marcaId, titulo, formato (`reels`/`carrossel`/`post`/`story`/`video`/`short`/`live`/`newsletter`/`artigo`/`outro`), etapa, roteiro, legenda, linkMaterial (Drive), responsavelId, dataGravacao, dataPublicacao, aprovadoPorId/Em, publicadoEm, criadoPorId, excluidoEm |
| `Publicacao` | id, conteudoId, canalId, status (`pendente`/`publicado`), url, publicadoEm, alcance, visualizacoes, curtidas, comentarios, compartilhamentos, salvamentos, metricasEm, metricasOrigem (`manual`/`instagram`) |
| `ContaInstagram` (C2a) | id, idExterno, usuario, nome, paginaId, fotoUrl, canalId (único), ativa | Conta profissional que a chave da Meta enxerga, ligada a um canal |
| `MidiaInstagram` (C2a) | id, contaId, idExterno, tipo (`post`/`carrossel`/`reels`/`story`), legenda, permalink, codigo, miniaturaUrl, publicadoEm, alcance, visualizacoes, curtidas, comentarios, salvamentos, compartilhamentos, interacoes, visitasPerfil, respostas, metricasEm, publicacaoId (único), removidaEm | Post ou story importado |
| `MetricaContaInstagram` (C2a) | contaId, periodo (`dia`/`mes`), data, alcance, visualizacoes, interacoes, curtidas, comentarios, salvamentos, compartilhamentos, cliquesLink, novosSeguidores, deixaramDeSeguir, seguidores | Números da conta por dia e por mês |
| `AtualizacaoInstagram` (C2a) | tipo (`completa`/`stories`), origem, status, iniciadoEm, finalizadoEm, registros, erro | Histórico das atualizações |

**Etapas do conteúdo:** `ideia` → `planejado` → `a_gravar` → `gravado` → `edicao` → `revisao` → `aprovado` → `publicado` (e `cancelado`). `publicado` é automático: acontece quando todas as publicações nos canais são marcadas.

## Telas (C1)
- `/conteudo`: visão geral (atrasados, próximos 7 dias, gravações marcadas, gravados aguardando edição, publicados no mês por plataforma).
- `/conteudo/planejamento`: quadro por etapa, de ideia a aprovado.
- `/conteudo/calendario`: calendário mensal por data de publicação, com opção de mostrar gravações.
- `/conteudo/gravacoes`: agenda de gravação e banco de gravados.
- `/conteudo/publicados`: publicações do mês com link, métricas e engajamento por canal.
- `/conteudo/itens/[id]`: detalhe, edição e registro das publicações e métricas.
- `/conteudo/configuracoes`: contas e canais (admin/gestor).
- `/conteudo/integracao-instagram` (C2a, só admin): situação da chave, contas do Instagram ligadas aos canais, últimas atualizações e "Atualizar agora".
- C2a: a visão geral ganhou o bloco **Instagram no mês** (seguidores, alcance, visualizações, interações, visitas ao perfil e cliques no link da bio, com variação e gráfico de seguidores); Publicados ganhou a seção **Instagram** com todos os posts e stories do mês e o botão "Ligar a um conteúdo"; no detalhe, a publicação ligada mostra os números "do Instagram", sem edição.
- Visual novo: cabeçalho padrão, números em cartões, chips de etapa, prazo e plataforma, telas vazias; tokens do tema.

Todas as visões têm uma barra de filtros (conta, canal, responsável, formato e etapa). O filtro fica salvo no cookie `conteudo_filtro` (só ids e códigos, por navegador, validade de 1 ano) e vale em todas as visões até a pessoa clicar em "Limpar filtros". As contas do menu lateral usam o mesmo filtro. O mês continua na URL (`?mes=`).

## Regras de negócio
1. Só gestor ou admin aprova. Uma publicação só pode ser marcada como publicada depois de `aprovado`.
2. Quem não aprova e altera roteiro ou legenda de um conteúdo aprovado o devolve para `revisao`.
2a. A partir de `planejado`, o conteúdo precisa de pelo menos um canal, sempre da mesma conta.
3. **Publicação automática** só existe para canais com API suportada e conectada (ver tabela abaixo). Nos demais, o status por canal é `manual`: a equipe publica por fora e marca como publicado informando a URL.
4. O job `publicar-agendados` roda a cada 5 min e publica os `PublicacaoCanal` com `agendadoPara <= agora`. Em caso de falha, marca `erro` com a mensagem, tenta de novo 2 vezes e notifica o responsável.
5. A publicação só fica `publicado` quando **todos** os canais estão `publicado` ou `manual` concluído.
6. Toda publicação via API gera auditoria.
7. Validações por canal antes de agendar: limite de caracteres, quantidade e proporção de mídias, formato aceito.

### Canais e capacidade de publicação
| Canal | Publicação automática | Observação |
|---|---|---|
| Instagram (conta profissional) | ✅ Feed, carrossel, reels (Graph API) | Stories têm suporte limitado. Exige conta Business ligada a uma página do Facebook |
| Facebook (página) | ✅ | Graph API |
| YouTube | ⚠️ Possível (upload de vídeo) | Fase posterior, exige verificação do app Google |
| LinkedIn (página) | ⚠️ Possível | Exige aprovação do app no LinkedIn |
| TikTok | ⚠️ Restrito | Content Posting API exige auditoria do app |
| Blog / e-mail / WhatsApp | ❌ manual na v1 | Depende das ferramentas usadas |

## Integrações
- **Instagram (C2a, métricas):** mesma chave do usuário do sistema do Meta Ads (`META_ACCESS_TOKEN`), lida em `src/lib/meta-graph.ts` + `servicos/instagram-graph.ts`. Jobs `importar-instagram` (diário, 4h) e `importar-stories-instagram` (de hora em hora). Regras: spec `docs/superpowers/specs/2026-11-04-conteudo-c2-instagram-metricas-design.md`, seção 5 (ligação automática pelo código do link, só com conteúdo aprovado ou publicado; ligação manual; números da publicação ligada copiados do post e não editáveis). Runbook: `docs/runbooks/instagram.md`.
- Meta Graph API (publicação no Instagram e Facebook) na C2b. As mídias precisam estar numa URL pública temporária (storage com URL assinada).
- **Tarefas:** tarefas de produção vinculadas à publicação.
- **Agenda:** opcionalmente, publicações agendadas aparecem na agenda do responsável.

## Situação da implementação
**C1 (feito):** contas e canais, pipeline de produção, planejamento, calendário, gravações, publicados com métricas manuais.

**C2a (feito, aguardando configuração):** métricas do Instagram — posts e stories desde 2026-01-01, números da conta, ligação aos conteúdos. Falta o usuário seguir `docs/runbooks/instagram.md`.

**C2b (próxima):** agendamento de publicações no Instagram. Depende da ADR de storage de mídia (URL pública para a Meta buscar a mídia) e da permissão `instagram_content_publish`.

## Fora do escopo (v1)
Métricas de engajamento por post, inbox de comentários e DMs, geração de conteúdo por IA, banco de mídias completo.

## Dúvidas em aberto
- Quais canais a IPEMaster usa hoje e com quais contas?
- Existe blog, e em qual plataforma (WordPress)? A plataforma de e-mail marketing está no Kommo ou é outra?
- Quem aprova: qualquer gestor ou uma pessoa específica?
