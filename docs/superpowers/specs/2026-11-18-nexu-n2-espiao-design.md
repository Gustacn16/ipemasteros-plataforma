# Nexu N2 — Espião de concorrentes ("sniper"): especificação

- **Status:** Aprovado pelo Gustavo em 2026-11-18
- **Data:** 2026-11-18
- **Base:** spec do N1 (`docs/superpowers/specs/2026-11-17-nexu-n1-design.md`), `docs/modulos/nexu.md`, `docs/modulos/conteudo.md` (integração Instagram C2a), `src/lib/meta-graph.ts`, `src/lib/ia/`, `docs/04-seguranca-permissoes.md`. Onde divergir deles, vale este documento.
- **Entregas:** N2a (esta spec em detalhe), N2b e N2c (esboço na seção 12; cada uma ganha uma spec curta antes de construir).

## 1. Objetivo e porquê
O Gustavo quer um **sniper** dos concorrentes: abrir uma tela e ver, em poucos minutos, **o que mudou** nos concorrentes desde a semana passada e merece ação. Isso inclui anúncio novo, oferta ou preço novo, conteúdo que estourou e palavra do Google que eles passaram a disputar. Junto vêm os indicadores de cada um e uma análise curta do que isso significa para a IPEMaster. Ele decide com isso ofertas, conteúdo e anúncios. O comercial usa para argumentar com o lead.

**Duas formas de uso (decisão do Gustavo: as duas):**
- **Monitoramento contínuo:** uma lista fixa de concorrentes, coletada sozinha toda semana, com histórico.
- **Sob demanda:** pelo Nexu, perguntar sobre os dados guardados ou pedir a análise na hora de qualquer perfil ou página, mesmo fora da lista.

**Critério de sucesso (N2a):** na segunda-feira, o Gustavo abre **Espião** e vê os sinais da semana dos 5 concorrentes. Por exemplo: "Concorrente X: Reels com 4× as visualizações médias do perfil, falando de [resumo do que foi dito]" e "Concorrente Y: a página da Pós em Dermatologia mudou o preço de 12× R$ 899 para 12× R$ 699". Cada sinal tem o link da origem. Abaixo ficam a tabela de indicadores e a análise da IA. No Nexu ele pergunta "o que o Concorrente X postou sobre residência este mês?" e recebe a resposta baseada nas transcrições.

## 2. Metas, não-metas e anti-metas
**Metas:** até 10 concorrentes (uso previsto: **5 de pós-graduação médica**); coleta semanal automática; sinais por regras fixas com origem verificável; indicadores; análise semanal por IA; consulta e análise sob demanda pelo Nexu; teto de gasto próprio.

**Não-metas (N2a):** SEO e anúncios do Google (N2b); anúncios da Meta (N2c); TikTok e YouTube; stories dos concorrentes (a API não entrega); ler comentários ou seguidores dos concorrentes; aviso por WhatsApp ou e-mail; ações automáticas a partir dos sinais.

**Anti-metas (falharia mesmo funcionando):**
- **Ruído:** um relatório cheio de mudanças triviais (rodapé, data, contador de vagas) que ninguém lê. Cada regra tem limiar e o texto da página passa por limpeza antes de comparar.
- **Gasto que surpreende:** a coleta tem teto próprio e para sozinha ao atingi-lo, com aviso.
- **Risco à conta da IPEMaster:** a N2a usa só a API oficial da Meta (Business Discovery). O robô de terceiros da N2c roda separado, sem a chave da IPEMaster.

## 3. Decisões
| # | Decisão | Quem |
|---|---|---|
| D1 | Contínuo + sob demanda | Gustavo |
| D2 | Caminho A: coletor com regras fixas detecta os sinais; a IA (Claude) só escreve a análise e os resumos | Gustavo |
| D3 | Ordem: N2a (Instagram, Reels transcritos, landing pages, sinais, tela, Nexu) → N2b (SEO e anúncios Google, DataForSEO) → N2c (anúncios Meta, Apify) | Gustavo |
| D4 | Ver: admin, gestor e comercial. Configurar (lista, teto, coletar agora): só admin. Colaborador não vê | Gustavo (aceitou a proposta) |
| D5 | Teto próprio do espião: US$ 10/mês inicial, ajustável pelo admin | Gustavo (aceitou a proposta) |
| D6 | O gasto com Claude do espião (`UsoIa.origem = "espiao"`) **também** conta no limite mensal geral de IA (é a mesma conta Anthropic). Serviços externos (Groq, DataForSEO, Apify) contam só no teto do espião | proposta (Claude) |
| D7 | Transcrição: Groq `whisper-large-v3-turbo` (US$ 0,04/hora de áudio, mínimo 10 s por pedido), todos os Reels novos dos concorrentes da lista, até 3 min por vídeo | proposta (Claude) |
| D8 | Sem sistema de notificação hoje: o "aviso" é um número no item **Espião** do menu (sinais novos desde a última visita da pessoa) | proposta (Claude) |
| D9 | Agenda: tarefa de cron `espiao` diária às 4h BRT; ela só coleta se a última coleta concluída tiver mais de 6 dias (falhou hoje → tenta amanhã). O Gustavo cria o cron no hPanel (o conector não pode) | proposta (Claude) |
| D10 | A coleta roda **em segundo plano no próprio processo Node** (o app da Hostinger é um servidor contínuo, não serverless): o cron e o "Coletar agora" criam a `ColetaEspiao`, respondem na hora e o trabalho continua depois da resposta. Cada passo é idempotente e marcado como feito; uma coleta `rodando` sem progresso há mais de 2 h é retomada do ponto em que parou na próxima chamada do cron. Só uma coleta por vez (trava pela linha `rodando`). Não depende da VPS do WhatsApp | proposta (Claude) |
| D11 | Papéis: `espiao:ver` = admin, gestor, comercial; `espiao:configurar` = admin (papéis já existentes em `Papel` e `src/lib/permissoes.ts`) | Gustavo |

## 4. Fontes da N2a
**Instagram (Business Discovery, oficial):** `GET /{ig-user-id-da-IPEMaster}?fields=business_discovery.username(<@>){...}` com a chave existente (`META_ACCESS_TOKEN`, via `criarPedidosGraph` de `src/lib/meta-graph.ts`). O `ig-user-id` é o `idExterno` da primeira `ContaInstagram` ativa. Campos: `followers_count`, `media_count`, `name`, `biography`, `website` e `media{id, caption, media_type, media_product_type, permalink, timestamp, like_count, comments_count, view_count, media_url}`. Só contas profissionais (Business ou Creator) aparecem; perfil pessoal ou privado gera o erro "perfil não é profissional" na tela do concorrente.
- `view_count` vem para os Reels de outras contas (referência oficial do Business Discovery).
- **Incerto:** `media_url` dos Reels de outras contas. Ele some quando o dono desliga o download. Por isso a **Tarefa 0** do plano é um teste (seção 9).
- Se `view_count` não vier numa mídia, a regra de destaque usa curtidas + comentários para ela, comparando com a mediana feita da mesma forma. Se `like_count` vier oculto, a mídia fica fora da regra de destaque.
- O token atual (usuário do sistema da Meta, com `instagram_basic` já usado pelo C2a) deve bastar para o Business Discovery; a Tarefa 0 confirma isso antes de qualquer outra tarefa.

**Landing pages:** a plataforma baixa o HTML das URLs cadastradas (até 10 por concorrente) e extrai o texto visível. Páginas montadas só por JavaScript podem vir quase vazias: o sistema detecta texto < 300 caracteres e marca a página como "não legível" (sem sinal falso).

**Transcrição:** baixa o vídeo do `media_url` (até 50 MB, tempo-limite de 60 s) e envia ao Groq como arquivo (multipart). Sem `media_url` → a mídia fica `sem_video` e a legenda é usada como conteúdo.

## 5. Modelo de dados (novas tabelas, `@@map` no plural snake_case)
| Modelo | Campos principais |
|---|---|
| `Concorrente` | id, nome, instagram (@, opcional), site (domínio, opcional), observacoes, ativo, criadoEm, atualizadoEm, excluidoEm |
| `PaginaConcorrente` | id, concorrenteId, url, rotulo ("Pós Dermato"), ativa, legivel, ultimoHash, ultimaCapturaEm |
| `VersaoPagina` | id, paginaId, hash, texto (LONGTEXT, texto limpo), precos (JSON: lista de preços achados), capturadaEm |
| `FotoInstagram` | id, concorrenteId, coletaId, seguidores, totalPosts, capturadaEm |
| `MidiaConcorrente` | id, concorrenteId, idExterno (único), tipo (`post`/`carrossel`/`reels`/`video`), legenda, permalink, publicadoEm, curtidas, comentarios, visualizacoes, metricasEm, transcricao (LONGTEXT, nulo), resumo (texto curto da IA, nulo), situacaoTranscricao (`pendente`/`feita`/`sem_video`/`longa_demais`/`falhou`/`nao_se_aplica`) |
| `ColetaEspiao` | id, origem (`agendada`/`manual`), status (`rodando`/`concluida`/`parcial`/`falhou`/`sem_saldo`), iniciadaEm, finalizadaEm, erros (JSON: concorrenteId + tipo de erro, sem texto original) |
| `SinalEspiao` | id, concorrenteId, coletaId, tipo (enum da seção 6), titulo, detalhe (JSON), origemUrl, criadoEm |
| `RelatorioEspiao` | id, coletaId (único), analise (markdown), criadoEm |
| `GastoEspiao` | id, servico (`groq`/`dataforseo`/`apify`), quantidade, custoMicroUsd, coletaId (nulo), usuarioId (nulo, sob demanda), criadoEm |
| `ConfiguracaoIa` (existente) | + `limiteEspiaoMicroUsd` Int default 10_000_000 |
| `Usuario` (existente) | + `espiaoVistoEm` DateTime? (para o número no menu) |

Ids `cuid`, datas UTC, uma migration Prisma. Histórico guardado por 18 meses: limpeza mensal de `VersaoPagina`, `FotoInstagram` e `SinalEspiao` mais antigos, sempre preservando a última versão de cada página.

## 6. Regras dos sinais (N2a)
Uma coleta gera sinais comparando com o que já estava guardado. **Semana** = segunda a domingo em `America/Sao_Paulo`; a tela agrupa coletas e sinais pela semana em que a coleta começou. Um "Coletar agora" no meio da semana é outra coleta da mesma semana: os sinais se somam (cada regra já evita repetir o mesmo sinal) e a análise da semana mostrada é a da coleta mais recente. **Primeira coleta de um concorrente não gera sinais**, só a linha de base.
| Tipo | Regra |
|---|---|
| `conteudo_destaque` | Mídia publicada nos últimos 14 dias com visualizações (Reels) ou curtidas + comentários (demais tipos) ≥ **3×** a mediana das últimas 30 mídias do mesmo tipo do perfil (exige ≥ 5 mídias do tipo). Um sinal por mídia, uma vez só (chave: `idExterno`), mesmo que ela só passe do limiar numa coleta posterior |
| `ritmo_mudou` | Posts nos últimos 7 dias ≥ 2× ou ≤ 0,5× a média semanal das 4 semanas anteriores (exige ≥ 4 posts nesse período) |
| `seguidores_salto` | Variação de seguidores ≥ +3% ou ≤ −2% em relação à `FotoInstagram` mais recente com 5 dias ou mais de idade (sem foto assim, não avalia) |
| `pagina_nova` | Página cadastrada que ficou legível pela primeira vez **depois** da linha de base (a primeira captura é a base) |
| `pagina_mudou` | Texto limpo mudou em ≥ 5% das palavras (diferença por palavras) em relação à versão anterior |
| `preco_mudou` | Conjunto de preços achados mudou (regex: `R$ 1.234,56`, `12x de R$ 99`, `12 x R$ 99,90`); o detalhe guarda antes e depois. Quando dispara, não gera `pagina_mudou` para a mesma página na mesma coleta |
| `bio_link_mudou` | `biography` ou `website` do perfil mudou |

**Limpeza do texto antes de comparar:** remove `script`, `style`, `nav`, `footer`, `header` e `noscript`; colapsa espaços; troca datas (dd/mm/aaaa), horas e números de contagem regressiva por marcadores. Assim, contador e data do dia não viram mudança.

**Resumos por IA** (modelo da `ConfiguracaoIa`, esforço baixo):
- cada Reels transcrito ganha um `resumo` de até 2 frases, com a promessa, a oferta e a chamada;
- `pagina_mudou` ganha um título que diz o que mudou, a partir das duas versões ("trocou a garantia de 7 para 30 dias").
A regra decide **se** há sinal; a IA só descreve.

## 7. Análise semanal
Ao fim de cada coleta concluída ou parcial, uma chamada ao Claude recebe os sinais da coleta e os indicadores de cada concorrente (seguidores, variação, posts por semana, engajamento médio, Reels de destaque com resumo). Ela escreve em português, em até ~400 palavras:
1. o que mudou de mais importante;
2. o que isso sugere sobre a estratégia de cada um;
3. até 3 ideias concretas para a IPEMaster (conteúdo, oferta ou anúncio).

O texto dos concorrentes entra como **dado**, entre marcadores, e o prompt de sistema manda ignorar instruções dentro dele. Grava `RelatorioEspiao` e `UsoIa` (origem `espiao`, sem texto).

## 8. Telas e Nexu
**Menu:** item **Espião** para quem tem `espiao:ver`, com o número de sinais novos desde `espiaoVistoEm`. Abrir `/espiao` atualiza `espiaoVistoEm`.

```
/espiao
┌ Semana de 17/11 · coleta concluída seg 04:12 ─ [Ver semanas anteriores ▾] ┐
│ 🎯 Sinais (6)                                     filtro: [concorrente ▾]  │
│ • Concorrente X — Reels 4× a média: "promete aprovação na prova…" [abrir]  │
│ • Concorrente Y — Preço: 12x R$ 899 → 12x R$ 699 (Pós Dermato)    [abrir]  │
├ Indicadores ───────────────────────────────────────────────────────────────┤
│ Concorrente | Seguidores (Δ sem.) | Posts/sem | Engaj. médio | Destaques   │
├ Análise da IA ─────────────────────────────────────────────────────────────┤
└────────────────────────────────────────────────────────────────────────────┘
```
- `/espiao/[id]`: o concorrente, com gráfico de seguidores por semana, mídias recentes (com métricas, transcrição e resumo), páginas (versão atual, histórico de versões com o que mudou) e sinais.
- `/espiao/configurar` (`espiao:configurar`):
  - CRUD de concorrentes e páginas, com exclusão lógica;
  - botão **Testar perfil**: mostra quais campos a Meta devolveu e se veio `media_url`;
  - situação das chaves (Meta, Groq);
  - teto do espião e gasto do mês (barra);
  - últimas coletas e botão **Coletar agora**.

**Ferramentas do Nexu** (permissão `espiao:ver`, todas do tipo consulta):
| Ferramenta | O que faz |
|---|---|
| `espiao_sinais` | sinais por período e concorrente |
| `espiao_concorrente` | indicadores, últimas mídias com resumo, páginas e últimas mudanças |
| `espiao_buscar_conteudo` | busca por palavra nas legendas e transcrições guardadas, filtrando no código com `nomeBusca` (lição do erro 1267; sem `contains` no banco) |
| `espiao_perfil_agora` | Business Discovery ao vivo de **qualquer** @ profissional: perfil e últimas 12 mídias com métricas, **sem** transcrever e sem guardar |
| `espiao_pagina_agora` | baixa e limpa o texto de **qualquer** URL pública (até 20 mil caracteres), sem guardar |

O resultado das ferramentas `_agora` vai marcado como conteúdo externo não confiável. O Nexu já não executa nada sem clique, então uma instrução escondida numa página não vira ação.

## 9. Coleta, erros e custos
- **Tarefa 0 (teste antes de construir o resto):** primeiro vem só o botão "Testar perfil" em `/espiao/configurar`, que recebe um @ e não precisa de tabela nova. Ele mostra quais campos a Meta devolveu para o perfil e para as últimas 12 mídias (`view_count`, `like_count`, `media_url`). O Gustavo testa com os 5 concorrentes reais.
  - **Passa** se `media_url` vier em pelo menos metade dos Reels testados.
  - Se não passar, a transcrição fica desligada (os campos continuam na migration, com `situacaoTranscricao = sem_video`) e o resumo usa a legenda; o resto segue igual.
  - Se a chave não tiver permissão, a tela diz qual falta e o plano para até o Gustavo ajustar na Meta.
- **Ordem por coleta:** para cada concorrente ativo:
  1. Instagram (perfil, foto semanal, mídias novas ou atualização das métricas das mídias dos últimos 30 dias);
  2. páginas;
  3. transcrições pendentes;
  4. resumos.

  Depois vêm os sinais e a análise. Erro num concorrente não para os outros: a coleta vira `parcial`, e o erro fica gravado como tipo, nunca como texto original.
- **Teto:** antes de cada passo pago (Groq ou Claude), confere o gasto do mês do espião (`GastoEspiao` + `UsoIa` origem `espiao`) contra `limiteEspiaoMicroUsd`. O limite geral de IA também vale para o Claude. Se estourar, para com `sem_saldo` e o aviso aparece na tela. As ferramentas `_agora` do Nexu não têm custo externo (Meta é grátis e o download da página é nosso). O custo delas é só o Claude da própria pergunta, que já conta como uso do Nexu (origem `nexu`) e no limite por pessoa do N1. Elas não gravam `GastoEspiao`.
- **Rede:**
  - Meta: limite de taxa → espera e tenta 1 vez.
  - Download de páginas: só `http`/`https`; recusa IP privado ou local (inclusive depois de redirecionamento; no máximo 3); até 2 MB; tempo-limite de 15 s; `User-Agent` genérico, sem dados da IPEMaster.
- **Custo previsto (5 concorrentes):**
  - Instagram: grátis.
  - Groq: menos de US$ 0,10/mês.
  - Claude (Haiku): ~US$ 1–3/mês.
  - N2a: **menos de US$ 4/mês**.
- **Chave nova:** `GROQ_API_KEY`. O Gustavo adiciona no hPanel (a API da Hostinger só troca a lista inteira).

## 10. Segurança e LGPD
- Permissões `espiao:ver` e `espiao:configurar`, checadas no servidor em toda Server Action, Route Handler e ferramenta.
- Auditoria: criar, editar e excluir concorrente ou página; alterar o teto; coletar agora.
- Dados guardados são **públicos e de empresas** (perfis profissionais, páginas de venda). Não coletar comentários, seguidores nem dados de pessoas; não guardar foto de pessoas (só links).
- Logs com ids e tipos de erro; nunca chave, nem texto de página ou transcrição.
- A chave da Meta nunca vai para a URL (já é assim em `meta-graph.ts`).

## 11. Testes
Vitest com respostas gravadas (fixtures) da Meta, do Groq e de HTML:
- cada regra de sinal, com limiares, mínimos e a primeira coleta sem sinal;
- limpeza de texto (data e contador não geram mudança);
- regex de preços;
- teto (para com `sem_saldo`);
- erro de um concorrente → `parcial`;
- bloqueio de IP privado e redirecionamento;
- permissões das ferramentas do Nexu;
- busca sem acento.

Sem chamadas reais na suíte.

## 12. Próximas entregas (esboço)
- **N2b — Google (DataForSEO, oficial):**
  - palavras orgânicas em que o domínio do concorrente aparece e mudanças de posição (Labs "ranked keywords");
  - anúncios ativos no Google pela Central de Transparência de Anúncios (`ads_search` por domínio).
  - Sinais: `palavra_nova`, `anuncio_google_novo`, `anuncio_google_longevo` (> 30 dias). Chaves `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`, custo estimado de poucos dólares por mês para 5 domínios (confirmar na página de preços).
- **N2c — Meta (Apify):**
  - anúncios ativos da Biblioteca de Anúncios por página do concorrente, via um ator do Apify (US$ 0,20–1 por mil anúncios). A API oficial da Meta no Brasil só cobre anúncios políticos.
  - Sinais: `anuncio_meta_novo`, `anuncio_meta_longevo`.
  - Risco: o robô lê a página da Meta por fora, contra as regras dela, e pode quebrar. Por isso roda sem a chave da IPEMaster e com chave `APIFY_TOKEN` própria.

## 13. O que fica para quem constrói
- Estrutura de pastas em `src/modulos/espiao/` (servicos, regras, fontes, acoes, componentes, esquemas), seguindo o padrão do Conteúdo C2a (repositório injetável e fetch injetável para teste).
- Algoritmo exato de diferença por palavras, layout fino das telas e textos de erro.
- Registrar as ferramentas novas em `TODAS_FERRAMENTAS` do Nexu e mencionar o espião no prompt do Nexu.
- Novo doc `docs/modulos/espiao.md`, ADR se surgir decisão de arquitetura nova (o download de URLs externas com bloqueio de rede interna merece uma), e um runbook curto: criar o cron `espiao` e a `GROQ_API_KEY`.

## 14. Riscos
- `media_url` dos Reels pode não vir (mitigação: Tarefa 0, cair para a legenda).
- Business Discovery só enxerga contas profissionais e tem limite de taxa (para 5 a 10 perfis por semana, folgado).
- Páginas montadas por JavaScript não são legíveis sem navegador. Fica como "não legível", e um navegador de verdade só entra depois, se fizer falta.
- Preço por regex pode errar em formatos exóticos; o detalhe mostra antes e depois para conferir.
