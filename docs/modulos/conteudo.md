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
| `Publicacao` | id, conteudoId, canalId, status (`pendente`/`publicado`), url, publicadoEm, alcance, visualizacoes, curtidas, comentarios, compartilhamentos, salvamentos, metricasEm |

**Etapas do conteúdo:** `ideia` → `planejado` → `a_gravar` → `gravado` → `edicao` → `revisao` → `aprovado` → `publicado` (e `cancelado`). `publicado` é automático: acontece quando todas as publicações nos canais são marcadas.

## Telas (C1)
- `/conteudo`: visão geral (atrasados, próximos 7 dias, gravações marcadas, gravados aguardando edição, publicados no mês por plataforma).
- `/conteudo/planejamento`: quadro por etapa, de ideia a aprovado.
- `/conteudo/calendario`: calendário mensal por data de publicação, com opção de mostrar gravações.
- `/conteudo/gravacoes`: agenda de gravação e banco de gravados.
- `/conteudo/publicados`: publicações do mês com link, métricas e engajamento por canal.
- `/conteudo/itens/[id]`: detalhe, edição e registro das publicações e métricas.
- `/conteudo/configuracoes`: contas e canais (admin/gestor).

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
- Meta Graph API (Instagram e Facebook) na F5. As mídias precisam estar numa URL pública temporária (storage com URL assinada).
- **Tarefas:** tarefas de produção vinculadas à publicação.
- **Agenda:** opcionalmente, publicações agendadas aparecem na agenda do responsável.

## Situação da implementação
**C1 (feito):** contas e canais, pipeline de produção, planejamento, calendário, gravações, publicados com métricas manuais.

**C2 (próxima, depende do usuário):** conexão com o Instagram (métricas automáticas e agendamento) via Meta Graph API. Pré-requisitos: conta profissional no Instagram, app na Meta aprovado, storage de mídia (ADR pendente) e cron na Hostinger. Ver seção 9 da especificação.

## Fora do escopo (v1)
Métricas de engajamento por post, inbox de comentários e DMs, geração de conteúdo por IA, banco de mídias completo.

## Dúvidas em aberto
- Quais canais a IPEMaster usa hoje e com quais contas?
- Existe blog, e em qual plataforma (WordPress)? A plataforma de e-mail marketing está no Kommo ou é outra?
- Quem aprova: qualquer gestor ou uma pessoa específica?
