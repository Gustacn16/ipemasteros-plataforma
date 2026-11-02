# Conteúdo C1 — Gestão de conteúdo: especificação

- **Status:** Aceito (revisado e aprovado pelo Claude por delegação do usuário em 2026-11-02)
- **Base:** `docs/modulos/conteudo.md`. Esta spec antecipa parte da F4 e redefine a hierarquia de canais. O módulo é atualizado durante a implementação.

## 1. Objetivo
Uma área única para planejar, gravar, publicar e medir o conteúdo de **várias contas** (ex.: IPEMaster e Pedro Prado), cada uma com várias plataformas (Instagram, YouTube, Newsletter…), sem misturar tudo.

O usuário pediu, como essenciais: **calendários, publicados, gravados e planejamento**. Pediu também, "se possível", métricas do Instagram conectado e agendamento pela plataforma. Isso exige integração com a Meta e fica na fase C2 (seção 9).

## 2. Modelos de referência aplicados
- **Calendário editorial:** uma data prevista de publicação por conteúdo, vista em mês, com cor por plataforma.
- **Pipeline de produção (kanban):** etapas fixas, iguais para toda a equipe, para o quadro não virar uma coleção de status diferentes. Etapas com dono e data.
- **Separação planejamento × produção × distribuição:** o conteúdo (a ideia/peça) é um só; as publicações dele em cada canal são registros filhos. Assim, um mesmo vídeo vai para Reels e Shorts sem duplicar o planejamento.
- **Banco de gravados:** o que já foi gravado e ainda não foi publicado fica visível, para não se perder material.
- **Métricas por publicação:** o resultado fica junto da peça publicada, comparável entre canais.

## 3. Vocabulário
| Termo | No sistema |
|---|---|
| Conta | **Marca** (ex.: IPEMaster, Pedro Prado) |
| Plataforma de uma conta | **Canal** (ex.: IPEMaster · Instagram, @ipemaster) |
| Peça de conteúdo | **Conteúdo** (ex.: "Reels: 3 erros na prova de residência") |
| Saída da peça num canal | **Publicação** (Conteúdo × Canal, com status, link e métricas) |

## 4. Modelo de dados
| Modelo | Campos |
|---|---|
| `Marca` | id, nome (≤60), cor, ordem, excluidoEm, criadoEm, atualizadoEm |
| `Canal` | id, marcaId, plataforma (`instagram`/`youtube`/`tiktok`/`facebook`/`linkedin`/`newsletter`/`blog`/`podcast`/`outro`), identificador? (≤100, ex.: @ipemaster), ordem, ativo, excluidoEm, criadoEm, atualizadoEm |
| `Conteudo` | id, marcaId, titulo (≤200), formato (`reels`/`carrossel`/`post`/`story`/`video`/`short`/`live`/`newsletter`/`artigo`/`outro`), etapa, roteiro (Text)?, legenda (Text)?, linkMaterial (≤500, pasta do Drive com brutos/editados)?, responsavelId?, dataGravacao (Date)?, dataPublicacao (Date)?, aprovadoPorId?, aprovadoEm?, publicadoEm?, criadoPorId, excluidoEm, criadoEm, atualizadoEm |
| `Publicacao` | id, conteudoId, canalId, status (`pendente`/`publicado`), url (≤500)?, publicadoEm?, alcance?, visualizacoes?, curtidas?, comentarios?, compartilhamentos?, salvamentos?, metricasEm?, criadoEm, atualizadoEm; único (conteudoId, canalId) |

Mídia: nesta fase o material fica no Google Drive (campo `linkMaterial`). Upload próprio depende do ADR de storage, pendente, e entra na C2 junto com a publicação automática.

## 5. Etapas (pipeline fixo)
`ideia` → `planejado` → `a_gravar` → `gravado` → `edicao` → `revisao` → `aprovado` → `publicado`, mais `cancelado`.

| Etapa | Significa |
|---|---|
| Ideia | Banco de ideias, sem compromisso de data |
| Planejado | Tem roteiro/briefing, canais e data prevista |
| A gravar | Gravação marcada (`dataGravacao`) |
| Gravado | Material bruto pronto, aguardando edição |
| Edição | Em edição/design |
| Revisão | Pronto para aprovação |
| Aprovado | Liberado para publicar |
| Publicado | Todas as publicações nos canais foram feitas |
| Cancelado | Descartado, sai das visões ativas |

**Regras:**
1. A partir de `planejado`, o conteúdo precisa de pelo menos um canal de destino.
2. Só admin e gestor movem para `aprovado` (aprovação registra quem e quando).
3. `publicado` não é escolhido à mão: o conteúdo vira `publicado` sozinho quando todas as suas publicações estão marcadas como publicadas. Desmarcar uma publicação devolve o conteúdo para `aprovado`.
4. Marcar uma publicação como publicada exige o conteúdo `aprovado` ou `publicado` e grava `publicadoEm` (agora, ou a data informada).
5. Quem não aprova e edita roteiro ou legenda de um conteúdo `aprovado` devolve ele para `revisao`.
6. **Atrasado:** `dataPublicacao` anterior a hoje (São Paulo) e etapa diferente de `publicado`/`cancelado`.
7. Os canais de destino precisam ser da mesma marca do conteúdo.
8. Exclusão lógica de marca, canal e conteúdo.

## 6. Permissões
| Permissão | admin | gestor | colaborador | professor |
|---|---|---|---|---|
| `conteudo:usar` (ver, criar, editar, mover etapas até revisão, registrar publicação e métricas) | ✅ | ✅ | ✅ | — |
| `conteudo:aprovar` | ✅ | ✅ | — | — |
| `conteudo:gerenciar_canais` (marcas e canais) | ✅ | ✅ | — | — |

Igual à matriz já existente em `docs/04-seguranca-permissoes.md` (planejar: admin/gestor/colaborador; aprovar e publicar: admin/gestor). Diferença consciente: o colaborador **registra** que publicou manualmente, mas só depois da aprovação, que continua exclusiva de admin/gestor.

## 7. Telas
Módulo com menu próprio, igual ao de Tarefas. Menu principal: item **Conteúdo**.

Menu do módulo: Visão geral, Planejamento, Calendário, Gravações, Publicados e, abaixo, **Contas**: árvore Marca → Canais. Clicar numa marca ou canal filtra a visão atual (`?marca=` / `?canal=`). Admin e gestor veem "Configurar contas".

| Rota | Conteúdo |
|---|---|
| `/conteudo` | **Visão geral:** cartões com atrasados, a publicar nos próximos 7 dias, gravações marcadas, gravados aguardando edição, publicados no mês por canal |
| `/conteudo/planejamento` | **Quadro** por etapa (colunas ideia → aprovado; publicado e cancelado ficam fora). Cartão: título, formato, plataformas, responsável e data. Mudar de etapa pelo seletor do cartão. Botão "Novo conteúdo" |
| `/conteudo/calendario?mes=AAAA-MM` | **Calendário** mensal por `dataPublicacao`, com cor e ícone por plataforma; opção de ver as datas de gravação. Navegar entre meses |
| `/conteudo/gravacoes` | **Gravações:** a gravar (por data, atrasadas em destaque) e banco de gravados (gravado e edição) |
| `/conteudo/publicados?mes=AAAA-MM` | **Publicados:** tabela por publicação com canal, data, link e métricas; totais do mês por canal e taxa de engajamento |
| `/conteudo/itens/[id]` | **Detalhe:** dados, etapa, roteiro, legenda, link do material, canais de destino e, para cada um, marcar como publicado (link e data) e preencher métricas |
| `/conteudo/configuracoes` | Marcas e canais (criar, renomear, cor, desativar) |

Taxa de engajamento = (curtidas + comentários + compartilhamentos + salvamentos) ÷ alcance, em %, "—" sem alcance.

## 8. Testes
Vitest nas regras puras (`src/modulos/conteudo/regras/`): transição de etapas (regras 1–3), etapa após marcar/desmarcar publicação, atraso em São Paulo, grade do mês (semanas de domingo a sábado, meses que começam no sábado e terminam no domingo), taxa de engajamento, matriz de permissões. Os serviços com banco são validados na homologação (não há banco local).

## 9. Fase C2 — Instagram conectado (próxima)
Viável pela API oficial da Meta (Instagram Graph API), para contas **profissionais** (Business ou Creator):
- **Métricas:** alcance, visualizações, curtidas, comentários, compartilhamentos e salvamentos por post, sincronizados uma vez por dia. Os campos de métricas da `Publicacao` já existem; a C2 só passa a preenchê-los com `origem = api`.
- **Agendamento:** a API publica na hora; o agendamento é feito pela plataforma (um job confere a cada 5 minutos o que está agendado). Feed, carrossel e reels são suportados.
- **Pré-requisitos que dependem do usuário:** conta do Instagram profissional; app de desenvolvedor na Meta com as permissões de conteúdo e métricas aprovadas na revisão da Meta; storage com URL pública para as mídias (ADR pendente); agendador de tarefas (cron) na Hostinger. Tokens guardados criptografados, nunca em log.

## 10. Fora do escopo da C1
Upload de mídia, publicação automática, sincronização de métricas, comentários e DMs, campanhas, aprovação em várias etapas, IA.

## 11. Ordem de implementação
1. Regras puras + testes.
2. Schema e migration (`prisma migrate diff`).
3. Permissões, serviços (acesso, marcas/canais, conteúdos, publicações, visões) e ações.
4. Layout do módulo + menu + visão geral + planejamento + novo conteúdo.
5. Calendário, gravações, publicados, detalhe, configurações.
6. Docs (`docs/modulos/conteudo.md`, matriz de permissões), build, publicação em `teste`.
