# Módulo: Conteúdo

## Objetivo
Planejar, aprovar e acompanhar a produção de conteúdo dos canais da IPEMaster num calendário editorial e, quando a API do canal permitir, **publicar direto pelo sistema**.

## Entidades
| Entidade | Campos principais |
|---|---|
| `Canal` | id, nome, tipo (`instagram`/`facebook`/`youtube`/`tiktok`/`linkedin`/`blog`/`email`/`whatsapp`/`outro`), contaExterna (ex.: @ipemaster), conectado (bool), credencialCriptografada?, ativo |
| `Campanha` | id, nome, cursoId?, objetivo, dataInicio, dataFim, cor |
| `Publicacao` | id, titulo, campanhaId?, formato (`post`/`carrossel`/`reels`/`story`/`video`/`artigo`/`email`/`outro`), briefing, legenda, status, dataPrevista, responsavelId, aprovadoPorId?, aprovadoEm? |
| `PublicacaoCanal` | id, publicacaoId, canalId, legendaPersonalizada?, agendadoPara?, statusPublicacao (`pendente`/`agendado`/`publicando`/`publicado`/`erro`/`manual`), idExterno?, urlPublicada?, erro?, publicadoEm? |
| `MidiaPublicacao` | id, publicacaoId, chaveStorage, tipo (imagem/vídeo), ordem, legendaAlt |

**Status da Publicação:**
`ideia` → `briefing` → `em_producao` → `em_revisao` → `aprovado` → `agendado` → `publicado` (também pode ir para `cancelado` em qualquer ponto).

## Telas
- `/conteudo/calendario`: calendário editorial mensal e semanal com cores por canal e campanha, arrastar para mudar a data e filtros por canal, campanha, responsável e status.
- `/conteudo/quadro`: kanban pelos status da publicação.
- `/conteudo/publicacoes/[id]`: briefing, legenda (com variação por canal), mídias, checklist de aprovação, canais de destino com status individual e tarefas vinculadas.
- `/conteudo/campanhas`: campanhas e as publicações de cada uma.
- `/conteudo/canais`: cadastro e conexão dos canais (admin/gestor).

## Regras de negócio
1. Só gestor ou admin aprova. Uma publicação só pode ser `agendado` ou publicada depois de `aprovado`.
2. Alterar legenda ou mídia de uma publicação já aprovada a devolve para `em_revisao`.
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

## Fora do escopo (v1)
Métricas de engajamento por post, inbox de comentários e DMs, geração de conteúdo por IA, banco de mídias completo.

## Dúvidas em aberto
- Quais canais a IPEMaster usa hoje e com quais contas?
- Existe blog, e em qual plataforma (WordPress)? A plataforma de e-mail marketing está no Kommo ou é outra?
- Quem aprova: qualquer gestor ou uma pessoa específica?
