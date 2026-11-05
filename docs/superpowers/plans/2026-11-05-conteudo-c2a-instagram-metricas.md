# Conteúdo C2a — Métricas do Instagram: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar do Instagram da IPEMaster os posts, os stories e os números deles e da conta (diário, de hora em hora e manual), ligar os posts às publicações dos conteúdos e mostrar tudo no início do Conteúdo, em Publicados e no detalhe do conteúdo.

**Architecture:** A base HTTP da Graph API sai do Comercial para `src/lib/meta-graph.ts`. No Conteúdo ficam as regras puras (`regras/instagram.ts`), o cliente (`servicos/instagram-graph.ts`, com `fetch` injetável), a atualização (`servicos/atualizacao-instagram.ts`), a ligação entre post e publicação (`servicos/ligacao-instagram.ts`) e as consultas das telas (`servicos/visao-instagram.ts`). Os jobs entram na rota de cron que já existe. Uma migration.

**Tech Stack:** Next.js 16.4.3 (`--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, `fetch` do Node, `after` do `next/server`.

**Spec:** `docs/superpowers/specs/2026-11-04-conteudo-c2-instagram-metricas-design.md`. Os números de regra citados abaixo (5.x) são dessa spec.

## Global Constraints

- Tudo em português (código de domínio, interface, docs, commits). Conventional Commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Várias sessões trabalham nesta pasta.** Commite só os seus arquivos (`git commit -m "..." -- <arquivos>`). Nunca use `git add -A`, stash, reset ou troca de branch. Branch `teste`.
- Antes de mexer em `prisma/schema.prisma`, rode `git status --short prisma/`: tem que estar vazio. A migration é gerada com `prisma migrate diff` (não há banco local), numa pasta com timestamp posterior à última de `prisma/migrations/` (hoje `20261108010000_…`).
- Antes de mexer em `src/modulos/comercial/**`, rode `git status --short src/modulos/comercial`: tem que estar vazio. Se houver alterações de outra sessão, pare e pergunte.
- Antes do push, rode `git log origin/teste..HEAD`. Se houver commits de outras sessões, pergunte ao Gustavo ou à sessão dona.
- `META_ACCESS_TOKEN` e `CRON_SECRET` só no servidor. Nunca vão para a tela, o log, o banco, as mensagens de erro ou a URL. A chave vai no header `Authorization` (como já faz `meta-graph.ts`).
- Versão da Graph API: a constante única `VERSAO_GRAPH` (hoje `"v26.0"`), movida para `src/lib/meta-graph.ts`.
- Datas em UTC no banco. "Hoje", "ontem" e "mês" são calculados em `America/Sao_Paulo` com `diaEmSaoPaulo`/`somarDias` de `@/modulos/tarefas/regras/prazo` (já usados pelo Meta Ads).
- Número que a Meta não informa é `null`, nunca 0. A tela mostra "—".
- As telas seguem a renovação visual de 2026-11-04: o markup fica em `src/modulos/conteudo/componentes/telas.tsx` (ou num componente novo do módulo), as páginas só buscam os dados, e as telas usam as peças de `src/componentes/` (`CabecalhoPagina`, `CartaoNumero`, `ChipSituacao`, `EstadoVazio` com `compacto`) e só tokens do tema.
- Formatação com prettier `--print-width 140`. Verificação de cada task: `npm run typecheck`, `npx vitest run <arquivos>`, `npx eslint <arquivos>`. No fim de cada entrega, também `npm run test` e `npx next build --webpack`.

## Review Focus

1. **Story com poucas visualizações:** a Meta responde erro de código 10 para métricas abaixo de 5. Isso deve virar `null` naquele story, não falha da atualização nem "sem permissão" (Task 3 `lerInsightsMidia` e Task 5).
2. **Link colado de jeitos diferentes:** `https://www.instagram.com/reel/ABC123/?igsh=xyz`, sem `www`, sem barra final, `/p/`, `/tv/` e o link do perfil (que não é post). A ligação automática tem que achar o mesmo `codigo` e ignorar o que não é post (Task 3 `codigoDoPermalink`).
3. **Dois conteúdos com o mesmo link**, ou um conteúdo ainda em `revisao`: a ligação automática não liga nada e o post fica "fora do planejamento" (Task 3 `escolherPublicacao`).
4. **Virada de mês às 21h–23h59 de São Paulo** (já é o dia seguinte em UTC): post publicado em 31/10 às 22h de Brasília conta em outubro (Task 3 `mesDoPost` e Task 7).
5. **Primeira carga interrompida pelo limite de uso da Meta:** a próxima atualização continua pelos posts sem `metricasEm`, sem refazer tudo e sem duplicar (Task 5).

---

## Entrega 1 — Conexão e importação

### Task 1: Base da Graph API em `src/lib`

**Files:**
- Create: `src/lib/meta-graph.ts`, `src/lib/meta-graph.test.ts`
- Modify: `src/modulos/comercial/servicos/meta-graph.ts`, `src/modulos/comercial/servicos/importacao-meta.ts` (só imports), `src/modulos/comercial/servicos/meta-graph.test.ts` e `importacao-meta.test.ts` (só imports, se preciso)

**Interfaces:**
- Produces (em `@/lib/meta-graph`):
  - `VERSAO_GRAPH = "v26.0"`, `BASE_GRAPH = \`https://graph.facebook.com/${VERSAO_GRAPH}\``
  - `class ErroMeta extends Error { codigo?: number }` (a mesma de hoje)
  - `criarPedidosGraph(token: string, traduzir: (codigo: number | undefined, mensagem: string) => string, fetchFn?: typeof fetch): { pedir<T>(url: string): Promise<Pagina<T>>; todas<T>(caminho: string, parametros: Record<string, string>, parar?: (item: T) => boolean): Promise<T[]> }`. `todas` para de paginar quando `parar(item)` for verdadeiro para algum item da página, e devolve só os itens anteriores a ele. `pedir` aceita URL completa ou caminho relativo a `BASE_GRAPH`.
  - `type Pagina<T> = { data?: T[]; paging?: { next?: string }; error?: { code?: number; message?: string } }`
- O Comercial continua exportando `ErroMeta` e `VERSAO_GRAPH` de `servicos/meta-graph.ts` (reexport), para nada mais mudar lá.

- [ ] **Step 1: Write the failing test** `src/lib/meta-graph.test.ts`: `todas` segue `paging.next`; `parar` interrompe a paginação e corta a página; erro HTTP com `{ error: { code: 190 } }` vira `ErroMeta` com a mensagem de `traduzir` e `codigo === 190`; falha de rede vira `ErroMeta("Não foi possível falar com a Meta.")`; o header enviado é `Authorization: Bearer <token>` e a URL não contém o token.
- [ ] **Step 2: Run** `npx vitest run src/lib/meta-graph.test.ts`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** `src/lib/meta-graph.ts`, movendo `pedir`/`todas` de `criarClienteMeta`. Depois troque o corpo de `criarClienteMeta` para usar `criarPedidosGraph(token, mensagemErroMeta, fetchFn)`.
- [ ] **Step 4: Run** `npx vitest run src/lib/meta-graph.test.ts src/modulos/comercial` e `npm run typecheck`. Expected: PASS, com os testes do Comercial sem mudança de asserção.
- [ ] **Step 5: Commit** `refactor(core): base da Graph API da Meta em src/lib`.

### Task 2: Permissão, modelos e migration

**Files:**
- Modify: `src/lib/permissoes.ts`, `src/lib/permissoes.test.ts`, `prisma/schema.prisma`
- Create: `prisma/migrations/20261109010000_conteudo_instagram/migration.sql`

**Interfaces:**
- Produces: a permissão `"conteudo:gerenciar_integracao_instagram"` (só admin, ao lado de `comercial:gerenciar_integracao_meta`) e os modelos da spec, seção 4, com estes nomes Prisma e tabelas:
  - enums `TipoMidiaInstagram { post carrossel reels story }`, `PeriodoMetricaInstagram { dia mes }`, `TipoAtualizacaoInstagram { completa stories }`, `OrigemMetricas { manual instagram }`. Reaproveite `OrigemImportacao` (`agendada`/`manual`) e `StatusImportacao` (`em_andamento`/`concluida`/`falhou`) do Meta Ads.
  - `ContaInstagram` → `contas_instagram` (relação 1–1 opcional com `Canal` por `canalId @unique`)
  - `MidiaInstagram` → `midias_instagram` (`publicacaoId @unique`, relação 1–1 opcional com `Publicacao`; `@@index([contaId, publicadoEm])`, `@@index([codigo])`)
  - `MetricaContaInstagram` → `metricas_conta_instagram` (`@@unique([contaId, periodo, data])`)
  - `AtualizacaoInstagram` → `atualizacoes_instagram` (`iniciadaPorId` → `Usuario`, como em `ImportacaoAnuncios`)
  - `Publicacao.metricasOrigem OrigemMetricas @default(manual) @map("metricas_origem")`

- [ ] **Step 1: Write the failing test** em `permissoes.test.ts`: admin tem `conteudo:gerenciar_integracao_instagram`; gestor, colaborador, comercial e professor não têm.
- [ ] **Step 2: Run** `npx vitest run src/lib/permissoes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** a permissão; confira `git status --short prisma/` (vazio); edite o schema; gere o SQL a partir do schema do último commit: `git show HEAD:prisma/schema.prisma > <scratchpad>/anterior.prisma` e `npx prisma migrate diff --from-schema <scratchpad>/anterior.prisma --to-schema prisma/schema.prisma --script`; confira no SQL que só entram as tabelas e colunas novas.
- [ ] **Step 4: Run** `npx prisma validate`, `npx prisma generate`, `npm run typecheck`, `npx vitest run src/lib/permissoes.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): modelos e permissão da integração com o Instagram`, com o schema, a migration e os dois arquivos de permissão.

### Task 3: Regras puras do Instagram

**Files:**
- Create: `src/modulos/conteudo/regras/instagram.ts`, `src/modulos/conteudo/regras/instagram.test.ts`

**Interfaces:**
- Produces:
  - `INICIO_HISTORICO_INSTAGRAM = "2026-01-01"`, `DIAS_POSTS_RECENTES = 30`, `DIAS_CONTA_REFEITOS = 7`
  - `PERMISSOES_INSTAGRAM = ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"] as const`
  - `METRICAS_POR_TIPO: Record<TipoMidia, readonly string[]>`, com as listas da regra 5.5 na ordem da spec
  - `type TipoMidia = "post" | "carrossel" | "reels" | "story"`; `tipoDaMidia(m: { media_type?: string; media_product_type?: string }): TipoMidia` (regra 5.3; `STORY` → `story`)
  - `codigoDoPermalink(url: string | null | undefined): string | null`: o trecho depois de `/p/`, `/reel/`, `/reels/` ou `/tv/`, sem query e sem barra; `null` para o que não é post
  - `type NumerosMidia = { alcance, visualizacoes, curtidas, comentarios, salvamentos, compartilhamentos, interacoes, visitasPerfil, respostas: number | null }`
  - `lerInsightsMidia(data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] | undefined): NumerosMidia`. Nomes da Meta → campos: `reach→alcance, views→visualizacoes, likes→curtidas, comments→comentarios, saved→salvamentos, shares→compartilhamentos, total_interactions→interacoes, profile_visits→visitasPerfil, replies→respostas`
  - `type NumerosConta = { alcance, visualizacoes, interacoes, curtidas, comentarios, salvamentos, compartilhamentos, cliquesLink, novosSeguidores, deixaramDeSeguir: number | null }`
  - `lerInsightsConta(data): NumerosConta`. `saves→salvamentos`, `profile_links_taps→cliquesLink`, `follows_and_unfollows` com `total_value.breakdowns[0].results[]` em que `dimension_values[0]` é `FOLLOWER`→`novosSeguidores` e `NON_FOLLOWER`→`deixaramDeSeguir`
  - `periodosConta(o: { hoje: string; primeiraVez: boolean }): { dias: string[]; meses: { mes: string; desde: string; ate: string }[] }` (regra 5.7; `mes` = `"AAAA-MM"`; o mês atual vai até ontem; no dia 1, o mês atual fica de fora porque ainda não tem dia fechado)
  - `postRecente(publicadoEm: Date, agora: Date): boolean` (≤ 30 dias)
  - `mesDoPost(publicadoEm: Date): string` (`"AAAA-MM"` em São Paulo)
  - `escolherPublicacao(codigo: string, candidatas: { id: string; url: string | null; etapa: string }[]): string | null` (regra 5.12: exatamente uma com o mesmo código e etapa `aprovado`/`publicado`)
  - `permissoesFaltando(concedidas: { permission: string; status: string }[]): string[]` (só `status === "granted"` conta)
  - `mensagemErroInstagram(codigo: number | undefined, mensagem: string): string` (regra 5.15; 10/200 → "A chave não tem permissão para ler o Instagram."; limite também em 32 e 80002); `MENSAGEM_SEM_CONTA_INSTAGRAM` com o texto exato da regra 5.15
  - `podeIniciarAtualizacao(emAndamento: { iniciadoEm: Date } | null, agora: Date): { pode: boolean; expirada: boolean }` (30 minutos, como no Meta Ads)

- [ ] **Step 1: Write the failing tests**, um `describe` por função, com os casos da spec, seção 10, e do Review Focus 2–4. Casos obrigatórios:
  - `codigoDoPermalink("https://www.instagram.com/reel/ABC123/?igsh=xyz") === "ABC123"`; `"instagram.com/p/XYZ"` → `"XYZ"`; `"https://www.instagram.com/ipemaster/"` → `null`
  - `escolherPublicacao`: duas candidatas com o mesmo código → `null`; uma em `revisao` → `null`
  - `mesDoPost(new Date("2026-11-01T01:00:00Z")) === "2026-10"`
  - `periodosConta({ hoje: "2026-11-02", primeiraVez: false })`: dias de 26/10 a 01/11; meses com outubro inteiro e `2026-11` de 01 a 01
  - `periodosConta({ hoje: "2026-11-05", primeiraVez: true })`: dias começando em `2026-01-01`, meses de `2026-01` a `2026-11`
  - `lerInsightsMidia([])` → todos `null`
- [ ] **Step 2: Run** `npx vitest run src/modulos/conteudo/regras/instagram.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** em `regras/instagram.ts`, sem rede nem banco.
- [ ] **Step 4: Run** de novo. Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): regras da importação do Instagram`.

### Task 4: Cliente da Graph API do Instagram

**Files:**
- Create: `src/modulos/conteudo/servicos/instagram-graph.ts`, `src/modulos/conteudo/servicos/instagram-graph.test.ts`, `src/modulos/conteudo/servicos/__fixtures__/instagram/*.json` (contas, contas-sem-ig, midias-1, midias-2, stories, insights-post, insights-story-erro-10, insights-conta, perfil, permissoes, erro-190)

**Interfaces:**
- Consumes: `criarPedidosGraph`, `ErroMeta` (Task 1); `mensagemErroInstagram` (Task 3).
- Produces: `criarClienteInstagram(token: string, fetchFn?: typeof fetch)` com:
  - `listarContas(): Promise<{ idExterno: string; usuario: string; nome: string | null; paginaId: string; fotoUrl: string | null }[]>` (regra 5.1; ignora páginas sem `instagram_business_account`)
  - `listarMidias(contaId: string, desde: Date): Promise<MidiaMeta[]>` (regra 5.3; `parar` quando `timestamp < desde`)
  - `listarStories(contaId: string): Promise<MidiaMeta[]>`
  - `insightsMidia(midiaId: string, tipo: TipoMidia): Promise<Insight[]>` (métricas de `METRICAS_POR_TIPO[tipo]`)
  - `insightsConta(contaId: string, desde: string, ate: string): Promise<Insight[]>`. `since` é 00:00 de `desde` e `until` é 00:00 do dia seguinte a `ate`, em São Paulo, como timestamp UNIX.
  - `seguidores(contaId: string): Promise<number | null>`
  - `permissoes(): Promise<{ permission: string; status: string }[]>` (`GET /me/permissions`)
  - `type MidiaMeta = { id; caption?; media_type; media_product_type?; permalink; timestamp; thumbnail_url?; media_url? }`; `type ClienteInstagram = ReturnType<typeof criarClienteInstagram>`

- [ ] **Step 1: Write the failing test**, no padrão de `comercial/servicos/meta-graph.test.ts` (`fetchFalso` por URL): contas sem Instagram são ignoradas; `listarMidias` segue a paginação e para no primeiro post anterior a 2026-01-01; erro 190 vira `ErroMeta` com "A chave de acesso da Meta é inválida ou foi revogada."; `insightsMidia` pede só as métricas do tipo (confira o parâmetro `metric` na URL); `insightsConta` manda `since`/`until` corretos para `("2026-11-01","2026-11-01")`; nenhuma URL contém o token.
- [ ] **Step 2: Run** `npx vitest run src/modulos/conteudo/servicos/instagram-graph.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Os campos e os parâmetros exatos estão nas regras 5.1, 5.3, 5.4, 5.6 e 5.16.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): cliente da Graph API do Instagram`.

### Task 5: Atualização completa, de stories e ligação automática

**Files:**
- Create: `src/modulos/conteudo/servicos/atualizacao-instagram.ts`, `src/modulos/conteudo/servicos/atualizacao-instagram.test.ts`, `src/modulos/conteudo/servicos/ligacao-instagram.ts`

**Interfaces:**
- Consumes: Tasks 2, 3 e 4.
- Produces:
  - `type ResultadoAtualizacao = { status: "concluida" | "falhou" | "recusada"; registros: number; erro?: string }`
  - `iniciarAtualizacao(o: { tipo: "completa" | "stories"; origem: "agendada" | "manual"; usuarioId?: string; agora?: Date; cliente?: ClienteInstagram }): Promise<{ status: "iniciada"; atualizacaoId: string; cliente: ClienteInstagram; agora: Date; tipo; origem } | ResultadoAtualizacao>`. Sem `META_ACCESS_TOKEN`, grava `falhou` com "Integração não configurada."; aplica a trava por tipo (regra 5.9).
  - `executarAtualizacao(inicio): Promise<ResultadoAtualizacao>`
  - `atualizarInstagram(o): Promise<ResultadoAtualizacao>` (inicia e executa; usada pelo cron)
  - Em `ligacao-instagram.ts`: `copiarParaPublicacao(tx, midiaId: string): Promise<void>` (regra 5.14: status, url, publicadoEm, `metricasOrigem = instagram`, números; depois recalcula a etapa com `etapaAposPublicacoes`, como em `registrarPublicacao`) e `ligarAutomaticamente(contaId: string): Promise<number>` (regra 5.12; devolve quantos ligou).
- Ordem da atualização completa, conta por conta (só `ativa` e com `canalId`):
  1. `listarContas` com upsert (regra 5.1). Nenhuma conta → `falhou` com `MENSAGEM_SEM_CONTA_INSTAGRAM`.
  2. `listarMidias` desde 2026-01-01 na primeira vez ou desde 30 dias atrás, com upsert. O post dos últimos 30 dias que sumiu da lista recebe `removidaEm` (regra 5.11).
  3. Números dos posts, nesta ordem: primeiro os sem `metricasEm`, depois os recentes (ou todos desde 2026-01-01 se `origem = manual`). Erro de um post: conta no aviso e segue. Erro de limite (4, 17, 32, 613, 80002): para os posts e fecha `concluida` com o aviso.
  4. Linhas `dia` e `mes` (regra 5.6) e `seguidores` de hoje.
  5. Stories no ar (regras 5.4 e 5.5).
  6. `ligarAutomaticamente` e `copiarParaPublicacao` de todos os posts já ligados que mudaram nesta rodada.
  7. Fecha a atualização com `registros` = posts + linhas gravados e o aviso "N posts sem números nesta atualização" em `erro`, se houver.
- A atualização `stories` roda só os passos 5 e 6.

- [ ] **Step 1: Write the failing test**, no padrão de `comercial/servicos/importacao-meta.test.ts` (banco em memória com `vi.hoisted` e cliente falso). Casos:
  - rodar duas vezes não duplica posts, linhas nem ligações
  - trava: a segunda `completa` em menos de 30 minutos é `recusada`, mas uma `stories` ao mesmo tempo roda
  - story com erro 10 grava números `null` e a atualização fica `concluida` sem aviso
  - erro em um post: os outros são gravados e o aviso diz "1 posts sem números nesta atualização" (ajuste para "1 post" no singular)
  - erro de limite no meio da primeira carga: na rodada seguinte, os posts sem `metricasEm` são pedidos primeiro
  - post cujo `codigo` está na `url` de uma publicação aprovada: fica ligado, a publicação vai para `publicado` com `metricasOrigem = instagram` e os números iguais aos do post
  - sem `META_ACCESS_TOKEN` → `falhou`, "Integração não configurada."
- [ ] **Step 2: Run** `npx vitest run src/modulos/conteudo/servicos/atualizacao-instagram.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Grave em lote por conta (`$transaction` com os upserts), como o Meta Ads faz desde `3ffe6b9`. Guarde em `erro` só mensagens de `ErroMeta` ou o texto genérico "Erro inesperado na atualização.".
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): atualização do Instagram e ligação automática`.

### Task 6: Cron, tela da integração e runbook

**Files:**
- Modify: `src/app/api/cron/[tarefa]/route.ts`, `src/modulos/conteudo/componentes/menu-conteudo.tsx` (entrada "Integração Instagram" só com a permissão)
- Create: `src/modulos/conteudo/acoes/instagram.ts`, `src/modulos/conteudo/servicos/integracao-instagram.ts`, `src/modulos/conteudo/componentes/integracao-instagram.tsx`, `src/app/(app)/conteudo/integracao-instagram/page.tsx`, `docs/runbooks/instagram.md`
- Test: `src/modulos/conteudo/servicos/integracao-instagram.test.ts`

**Interfaces:**
- Consumes: Task 5.
- Produces:
  - tarefas de cron `"importar-instagram"` → `atualizarInstagram({ tipo: "completa", origem: "agendada" })` e `"importar-stories-instagram"` → `tipo: "stories"`, respondendo `{ ok, status, registros }` como `importar-meta-ads`
  - `situacaoIntegracao(ator): Promise<{ situacao: "conectada" | "falta_permissao" | "nao_configurada" | "chave_invalida"; faltando: string[]; contas: (ContaInstagram & { canal: { id; identificador } | null })[]; atualizacoes: AtualizacaoInstagram[]; canaisInstagram: { id; identificador; marca: string }[] }>`. Exige `conteudo:gerenciar_integracao_instagram`; chama `permissoes()` uma vez por abertura de tela.
  - `ligarContaCanal(ator, contaId: string, canalId: string | null): Promise<void>` (regra 5.2: canal ativo, de plataforma `instagram`, sem outra conta; senão `ErroNegocio("Este canal já está ligado a outra conta.")`); `definirContaAtiva(ator, contaId, ativa)`
  - ações `atualizarInstagramAgoraAcao()` (com `after`, como `comercial/acoes/meta-ads.ts`), `ligarContaCanalAcao(dados: unknown)` (Zod) e `definirContaInstagramAtivaAcao(contaId, ativa)`
  - tela no padrão de `comercial/componentes/integracao-meta.tsx`, com as peças de `src/componentes/`, o conteúdo da spec, seção 7, e a atualização automática da tela enquanto houver uma atualização `em_andamento`

- [ ] **Step 1: Write the failing test** de `integracao-instagram.test.ts`: `ligarContaCanal` recusa canal de outra plataforma, canal já ligado e ator sem a permissão; `situacaoIntegracao` devolve `falta_permissao` com a lista em ordem quando `permissoes()` não traz `instagram_manage_insights`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** o serviço, as ações, a tela, a entrada no menu e as duas tarefas de cron. Escreva `docs/runbooks/instagram.md` com os passos da spec, seção 8, no formato de `docs/runbooks/meta-ads.md`: um passo por vez, a chave nunca no chat e a tabela de problemas comuns com as mensagens da regra 5.15.
- [ ] **Step 4: Run** os testes, `npm run typecheck`, `npm run test`, `npx next build --webpack`. Expected: PASS. Confira também, com `curl` local ou pelo teste da rota, que `/api/cron/importar-instagram` sem header responde 401.
- [ ] **Step 5: Commit** `feat(conteudo): tela da integração com o Instagram, cron e runbook`.
- [ ] **Step 6: Publicar e configurar com o Gustavo.** Siga o Global Constraint do push. Depois, guie o Gustavo pelo runbook, um passo por mensagem. Na primeira carga, confira o **risco do período mensal** (spec, seção 11): se a Meta recusar a linha `mes`, aplique a alternativa da spec antes da entrega 2. Confira 3 posts contra o aplicativo do Instagram.

## Entrega 2 — Telas

### Task 7: Bloco Instagram no início do Conteúdo

**Files:**
- Create: `src/modulos/conteudo/servicos/visao-instagram.ts`, `src/modulos/conteudo/componentes/bloco-instagram.tsx`
- Modify: `src/modulos/conteudo/regras/instagram.ts` e o teste (totais), `src/modulos/conteudo/componentes/telas.tsx` (`TelaVisaoGeral` recebe e mostra o bloco), `src/app/(app)/conteudo/page.tsx`

**Interfaces:**
- Produces:
  - em `regras/instagram.ts`: `variacao(atual: number | null, anterior: number | null): number | null` (divisor 0 ou ausente → `null`) e `totaisDoMes(o: { mes: NumerosConta | null; mesAnterior: NumerosConta | null; seguidores: number | null; seguidoresAnterior: number | null; visitasPerfil: number | null; visitasPerfilAnterior: number | null }): CartoesInstagram`, um cartão por número da regra 5.17, cada um `{ valor: number | null; variacao: number | null }`
  - `visaoInstagram(ator, f: FiltroConteudo, mes: string): Promise<{ cartoes: CartoesInstagram; seguidoresPorDia: { data: string; seguidores: number }[]; atualizadoEm: Date | null } | null>`. Devolve `null` quando nenhuma conta do filtro tem Instagram ligado. Nesse caso, quem tem a permissão da integração vê "Instagram não conectado" com o link.
- [ ] **Step 1: Write the failing test** de `variacao` e `totaisDoMes`: seguidores do mês = último total do mês, variação contra o último do mês anterior; visitas ao perfil vêm da soma dos posts; mês anterior ausente → `variacao: null`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** a regra, o serviço e o bloco: `CartaoNumero` por cartão, com a observação "vindas dos posts e stories" em visitas ao perfil; um gráfico de linha simples de seguidores, em SVG próprio ou na biblioteca que o dashboard do Comercial já usa (não adicione dependência); "Dados do Instagram atualizados em DD/MM às HH:MM".
- [ ] **Step 4: Run** testes e typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): bloco do Instagram na visão geral`.

### Task 8: Publicados com todos os posts e ligação manual

**Files:**
- Modify: `src/modulos/conteudo/servicos/ligacao-instagram.ts`, `src/modulos/conteudo/servicos/visao-instagram.ts`, `src/modulos/conteudo/acoes/instagram.ts`, `src/modulos/conteudo/componentes/telas.tsx` (`TelaPublicados`), `src/app/(app)/conteudo/publicados/page.tsx`
- Create: `src/modulos/conteudo/componentes/ligar-midia.tsx`, `src/modulos/conteudo/servicos/ligacao-instagram.test.ts`

**Interfaces:**
- Produces:
  - `listarMidiasDoMes(ator, mes: string, f: FiltroConteudo, ordem: "data" | "alcance" | "interacoes"): Promise<LinhaMidia[]>` (sem `removidaEm`; com o título e o id do conteúdo ligado). `type LinhaMidia`.
  - `candidatasParaLigar(ator, midiaId: string): Promise<{ publicacaoId: string; conteudoId: string; titulo: string; dataPublicacao: Date | null }[]>` (regra 5.13)
  - `ligarMidia(ator, midiaId: string, publicacaoId: string): Promise<void>` e `desligarMidia(ator, midiaId: string): Promise<void>`, que exigem `conteudo:usar`. A publicação precisa ser do canal da conta do post, sem outro post ligado, e de um conteúdo em `aprovado`/`publicado`; senão `ErroNegocio` com mensagem em português.
  - ações `ligarMidiaAcao(dados: unknown)` e `desligarMidiaAcao(midiaId: string)` (Zod, `revalidatePath` de Publicados e do item)
  - A ordem fica na URL como `?ordem=`, ao lado de `?mes=`, sem dado pessoal.
- [ ] **Step 1: Write the failing test** de `ligacao-instagram.test.ts`, com banco em memória: ligar aplica a regra 5.14 e o conteúdo vai para `publicado` quando era o último canal; ligar a uma publicação já ligada é recusado; ligar a um conteúdo em `revisao` é recusado; desligar volta `metricasOrigem` para `manual` e mantém os números; `candidatasParaLigar` ordena pela data mais próxima da data do post.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** os serviços, as ações e a tela: em Publicados, as mídias do mês junto com as publicações manuais dos outros canais, como hoje; a linha com miniatura (`<img>` com `onError` caindo para o ícone do tipo), selo do tipo, data, números, link do Instagram, `ChipSituacao` "fora do planejamento" e o botão "Ligar a um conteúdo" (diálogo com a lista de candidatas); seletor de ordem; `EstadoVazio compacto` para mês sem posts.
- [ ] **Step 4: Run** testes, typecheck e `npx next build --webpack`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): publicados com os posts do Instagram e ligação manual`.

### Task 9: Detalhe do conteúdo e documentação

**Files:**
- Modify: `src/modulos/conteudo/servicos/conteudos.ts` (`obterConteudo` inclui a mídia ligada; `salvarMetricas` recusa `metricasOrigem = instagram`), `src/modulos/conteudo/componentes/publicacoes-conteudo.tsx`, `docs/modulos/conteudo.md`, `docs/02-arquitetura.md`
- Test: `src/modulos/conteudo/servicos/conteudos.test.ts` (crie se não existir, no padrão de banco em memória) ou o teste do esquema, se a recusa ficar lá

**Interfaces:**
- Consumes: `desligarMidiaAcao` (Task 8).
- [ ] **Step 1: Write the failing test**: `salvarMetricas` numa publicação com `metricasOrigem = instagram` lança `ErroNegocio("Os números desta publicação vêm do Instagram.")`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement**: no detalhe, a publicação ligada mostra os números com o selo "do Instagram", sem campos editáveis, com o link do post e "Desligar". Atualize `docs/modulos/conteudo.md` (entidades novas, telas, regras 5.12–5.14, situação da implementação com a C2a feita e a C2b próxima) e `docs/02-arquitetura.md` (tabela de integrações: Instagram com a chave de usuário do sistema; jobs `importar-instagram` e `importar-stories-instagram`).
- [ ] **Step 4: Run** `npm run typecheck`, `npm run test`, `npx eslint src/modulos/conteudo`, `npx next build --webpack`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(conteudo): números do Instagram no detalhe do conteúdo` e, em separado, `docs(conteudo): C2a no ar`.
- [ ] **Step 6: Publicar** (Global Constraint do push) e passar ao Gustavo um roteiro curto de homologação: abrir o início do Conteúdo, conferir os cartões contra o app do Instagram, ligar um post "fora do planejamento" e ver o conteúdo ir para publicado.
