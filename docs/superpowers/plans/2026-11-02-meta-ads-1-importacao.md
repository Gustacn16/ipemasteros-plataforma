# Meta Ads — Entrega 1 (Conexão e importação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar da Marketing API da Meta as contas, as campanhas e os números diários (investimento, impressões, alcance, cliques e os três tipos de lead), de forma automática (cron diário) e manual ("Atualizar agora"), com histórico de importações e uma tela de situação da integração.

**Architecture:** Regras puras em `src/modulos/comercial/regras/meta-ads.ts`; cliente HTTP da Graph API em `servicos/meta-graph.ts`, com `fetch` injetável para testar com respostas gravadas; orquestração em `servicos/importacao-meta.ts`; rota `src/app/api/cron/[tarefa]/route.ts` protegida por `CRON_SECRET`; tela `src/app/(app)/comercial/integracao-meta/page.tsx`. Uma migration.

**Tech Stack:** Next.js 16.4.3 (`--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, `fetch` nativo do Node 24, `node:crypto` (`timingSafeEqual`).

**Spec:** `docs/superpowers/specs/2026-11-02-meta-ads-design.md` (seções 3, 4, 5.1–5.7, 6, 7 `/comercial/integracao-meta`, 8, 9.1, 10, 11).

## Global Constraints

- As mesmas das entregas do Comercial: português; commits só dos próprios arquivos (`git commit -m "..." -- <arquivos>`); `git status --short prisma/` vazio antes de mexer no schema; migration via `prisma migrate diff`, com timestamp posterior à última pasta; prettier `--print-width 140`; verificação com typecheck, test, eslint e `next build --webpack`. **Antes do push, conferir com `git log origin/teste..HEAD` se há commits de outras sessões e perguntar ao usuário ou à sessão dona.**
- `META_ACCESS_TOKEN` e `CRON_SECRET` são lidos só no servidor (`process.env`), nunca vão para a tela, para o log, para o banco, para mensagens de erro ou para a URL. A chave vai na query `access_token` da Graph API (padrão da Meta) e por isso a URL das chamadas também nunca é logada.
- Versão da Graph API numa constante única `VERSAO_GRAPH` em `servicos/meta-graph.ts`. Antes de fixar, confirmar na documentação da Meta (changelog da Graph API) a versão estável mais recente e anotar a escolha no ledger.
- Datas da Meta (`date_start`) são dias no fuso da conta de anúncio; gravar como estão, em `@db.Date`.
- Dinheiro: `spend` chega como string decimal ("123.45"); somar em centavos.

## Review Focus

1. A chave da Meta aparecendo em algum lugar: mensagem de erro com a URL, log de `fetch` com falha, resposta da rota de cron, estado da tela — Task 3 e Task 5.
2. Rota de cron chamada sem header, com segredo errado, com segredo de tamanho diferente ou com `CRON_SECRET` vazio no ambiente → 401 sem detalhes (nunca "aceita tudo" quando a variável falta) — Task 2 (`segredoValido`) e Task 5.
3. Rodar a importação duas vezes no mesmo período, ou a agendada e a manual quase juntas → mesmos números, sem duplicar, e a segunda recusada enquanto a primeira roda — Task 2 (`podeIniciarImportacao`) e Task 4.
4. Uma conta com erro (sem permissão) ou em outra moeda não impede as outras; a importação termina `concluida` com o erro da conta anotado — Task 4.
5. Resposta da Meta paginada (`paging.next`) e `actions` ausente ou com tipos desconhecidos → todos os dias importados, leads zero sem quebrar — Task 2 e Task 3.

---

### Task 1: Permissões da integração

**Files:**
- Modify: `src/lib/permissoes.ts`
- Test: `src/lib/permissoes.test.ts`

**Interfaces:**
- Produces: `"comercial:ver_marketing"` e `"comercial:atribuir_campanhas"` (admin e gestor) e `"comercial:gerenciar_integracao_meta"` (só admin).

- [ ] **Step 1: Write the failing test** (`describe("Meta Ads")`): admin tem as 3; gestor tem `ver_marketing` e `atribuir_campanhas`, mas não `gerenciar_integracao_meta`; comercial, colaborador e professor não têm nenhuma.
- [ ] **Step 2: Run** `npx vitest run src/lib/permissoes.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** em `permissoes.ts` (as duas primeiras em `COMERCIAL_GESTAO`; a terceira só no admin, como `comercial:excluir_produtos`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): permissões do Meta Ads`.

---

### Task 2: Regras puras da importação e do cron

**Files:**
- Create: `src/modulos/comercial/regras/meta-ads.ts`, `src/lib/cron.ts`
- Test: `src/modulos/comercial/regras/meta-ads.test.ts`, `src/lib/cron.test.ts`

**Interfaces:**
- Produces:
  - `ACOES_LEAD = { formulario: "onsite_conversion.lead_grouped", site: "offsite_conversion.fb_pixel_lead", conversas: "onsite_conversion.messaging_conversation_started_7d" }`.
  - `lerLeads(actions: { action_type: string; value: string }[] | undefined): { leadsFormulario: number; leadsSite: number; conversasIniciadas: number; ignorados: string[] }` (spec 5.2; `ignorados` = tipos recebidos e não contados, sem repetição).
  - `centavosDoGasto(spend: string | undefined): number`.
  - `INICIO_HISTORICO = "2026-01-01"`; `periodosImportacao(o: { temDados: boolean; hoje: string }): { desde: string; ate: string }[]` — com dados: um período de `hoje − 7` até `hoje − 1`; sem dados: de `INICIO_HISTORICO` até `hoje − 1` em blocos de até 30 dias.
  - `mensagemErroMeta(codigo: number | undefined, mensagem: string): string` (spec 5.6).
  - `podeIniciarImportacao(emAndamento: { iniciadoEm: Date } | null, agora: Date): { pode: boolean; expirada: boolean }` — 30 minutos (spec 5.5).
  - Em `src/lib/cron.ts`: `segredoValido(cabecalho: string | null, segredo: string | undefined): boolean` — `false` se o segredo for vazio ou ausente; compara `Bearer <segredo>` com `timingSafeEqual`, tratando tamanhos diferentes como `false`.

- [ ] **Step 1: Write the failing tests**:
  - `lerLeads` com os três tipos ("3", "2", "5"), mais `lead` e `link_click` → `{ 3, 2, 5, ignorados: ["lead", "link_click"] }`; `undefined` → zeros.
  - `centavosDoGasto("123.45")` → 12345; `undefined` → 0.
  - `periodosImportacao({ temDados: true, hoje: "2026-11-02" })` → `[{ desde: "2026-10-26", ate: "2026-11-01" }]`.
  - `periodosImportacao({ temDados: false, hoje: "2026-03-05" })` → blocos contíguos de até 30 dias, o primeiro começando em "2026-01-01", o último terminando em "2026-03-04", sem buracos nem sobreposição.
  - `mensagemErroMeta(190, "x")` → "A chave de acesso da Meta é inválida ou foi revogada."; `17` → "A Meta limitou as consultas. Tente de novo em alguns minutos."; `100` com "abc" → "Erro da Meta: abc".
  - `podeIniciarImportacao`: `null` → pode; há 10 minutos → não pode; há 40 minutos → pode e `expirada: true`.
  - `segredoValido("Bearer s3gr3d0", "s3gr3d0")` → true; segredo errado, `null`, tamanho diferente, `segredo` vazio ou `undefined` → false.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/regras/meta-ads.test.ts src/lib/cron.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `regras/meta-ads.ts` e `lib/cron.ts` (datas com `somarDias` de `@/modulos/tarefas/regras/prazo`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): regras da importação do Meta Ads e do cron`.

---

### Task 3: Cliente da Graph API

**Files:**
- Create: `src/modulos/comercial/servicos/meta-graph.ts`
- Create: `src/modulos/comercial/servicos/__fixtures__/meta/` (respostas JSON gravadas: contas, campanhas, insights em 2 páginas, erro 190, erro 10)
- Test: `src/modulos/comercial/servicos/meta-graph.test.ts`

**Interfaces:**
- Consumes: `mensagemErroMeta` (Task 2).
- Produces:
  - `VERSAO_GRAPH` (constante, ver Global Constraints).
  - `class ErroMeta extends Error { codigo?: number }` com `message` já em português (`mensagemErroMeta`), **sem a URL nem a chave**.
  - `criarClienteMeta(token: string, fetchFn: typeof fetch = fetch)` → `{ listarContas(): Promise<{ id: string; name: string; currency: string; account_status: number }[]>; listarCampanhas(contaId: string): Promise<{ id: string; name: string; status: string; objective?: string }[]>; listarInsights(contaId: string, desde: string, ate: string): Promise<{ campaign_id: string; date_start: string; spend?: string; impressions?: string; reach?: string; clicks?: string; actions?: { action_type: string; value: string }[] }[]> }`.
  - Cada lista segue `paging.next` até o fim. Insights com `level=campaign`, `time_increment=1`, `time_range={"since","until"}`, `limit=500`. Contas em `/me/adaccounts`, campanhas em `/{conta}/campaigns` (`limit=500`).
  - O arquivo não importa `server-only`, para poder ser testado com Vitest. Não loga nada.

- [ ] **Step 1: Write the failing tests** com um `fetchFn` falso que serve as fixtures pela URL: junta as 2 páginas de insights; erro 190 vira `ErroMeta` com `codigo` 190 e mensagem em português; nenhuma mensagem de erro contém o token usado no teste (`"TOKEN-DE-TESTE"`); uma falha de rede (`fetchFn` rejeitando) vira `ErroMeta` "Não foi possível falar com a Meta." sem a URL.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/servicos/meta-graph.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `meta-graph.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): cliente de leitura da Graph API da Meta`.

---

### Task 4: Modelos, migration e importação

**Files:**
- Modify: `prisma/schema.prisma` (`ContaAnuncio`, `CampanhaAnuncio`, `MetricaDiariaAnuncio`, `ImportacaoAnuncios`, enums `AtribuicaoCampanha`, `OrigemImportacao`, `StatusImportacao`; relação de `CampanhaAnuncio` com `Produto` e de `ImportacaoAnuncios` com `Usuario`)
- Create: `prisma/migrations/<timestamp>_comercial_meta_ads/migration.sql`
- Create: `src/modulos/comercial/servicos/importacao-meta.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
  - Tabelas `contas_anuncio`, `campanhas_anuncio`, `metricas_diarias_anuncio` (único `[campanhaId, data]`, índice `[data]`), `importacoes_anuncios` (índice `[iniciadoEm]`), com os campos da spec, seção 4.
  - `importarMetaAds(o: { origem: "agendada" | "manual"; usuarioId?: string; agora?: Date; cliente?: ReturnType<typeof criarClienteMeta> }): Promise<{ status: "concluida" | "falhou" | "recusada"; registros: number; erro?: string }>`:
    1. Sem `META_ACCESS_TOKEN` (e sem `cliente` injetado): grava importação `falhou` "Integração não configurada.".
    2. `podeIniciarImportacao` com a última `em_andamento`; recusada → não grava nada e devolve `recusada`; expirada → marca a antiga `falhou` "Interrompida".
    3. Cria a importação `em_andamento`; lê as contas (`upsert` por `idExterno`, mantendo `ativa`); para cada conta ativa: campanhas (`upsert` por `idExterno`, sem mexer em `atribuicao`/`produtoId`), períodos de `periodosImportacao` (`temDados` = existe alguma métrica), insights por período e `upsert` por (campanha, data), com `lerLeads` e `centavosDoGasto`. Insight de campanha desconhecida cria a campanha com o `campaign_id` e o nome "Campanha <id>".
    4. Erro numa conta vai para a lista de erros e o laço segue; erro em `listarContas` encerra como `falhou`.
    5. Fecha com `concluida` (ou `falhou`), `finalizadoEm`, `registros` (métricas gravadas), `desde`/`ate` do maior período e `erro` com os erros das contas e os `ignorados` (até 20 tipos), separados por linha.
  - `situacaoIntegracao()` → `{ configurada: boolean; contas: { id, idExterno, nome, moeda, ativa }[]; importacoes: { id, origem, status, iniciadoEm, finalizadoEm, desde, ate, registros, erro }[] (últimas 10, datas como ISO) }`.
  - `definirContaAtiva(contaId: string, ativa: boolean)`.

- [ ] **Step 1: Confirm** `git status --short prisma/` vazio.
- [ ] **Step 2: Add** os modelos; gerar a migration. Expected: só as 4 tabelas novas, os índices e as FKs.
- [ ] **Step 3: Implement** `importacao-meta.ts` (com `import "server-only"`).
- [ ] **Step 4: Run** `npm run typecheck` e `npm run test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): tabelas e importação diária do Meta Ads`.

---

### Task 5: Rota de cron, ações e tela da integração

**Files:**
- Create: `src/app/api/cron/[tarefa]/route.ts`, `src/modulos/comercial/acoes/meta-ads.ts`, `src/app/(app)/comercial/integracao-meta/page.tsx`, `src/modulos/comercial/componentes/integracao-meta.tsx`
- Modify: `src/modulos/comercial/componentes/abas-comercial.tsx` (aba "Meta Ads", só com `comercial:gerenciar_integracao_meta`), `src/app/(app)/comercial/layout.tsx` (passar a permissão para as abas)

**Interfaces:**
- Consumes: Task 4; `segredoValido` (Task 2).
- Produces:
  - `GET /api/cron/[tarefa]`: `segredoValido(request.headers.get("authorization"), process.env.CRON_SECRET)`, senão `401` com corpo `{"ok":false}`. Tarefa `importar-meta-ads` chama `importarMetaAds({ origem: "agendada" })` e responde `{ ok, status, registros }`, sem a mensagem de erro (que fica na tela). Tarefa desconhecida → 404. `export const dynamic = "force-dynamic"`.
  - `atualizarMetaAgoraAcao(): Promise<EstadoAcao>` — exige `comercial:gerenciar_integracao_meta`; mensagens "Importação concluída: N registros.", "Já existe uma importação em andamento." ou a mensagem de erro.
  - `definirContaAtivaAcao(contaId: string, ativa: boolean): Promise<EstadoAcao>`.
- [ ] **Step 1: Rota e ações.**
- [ ] **Step 2: Tela** `/comercial/integracao-meta` (`exigirPermissaoPagina("comercial:gerenciar_integracao_meta")`): situação ("Conectada" quando a última importação deu certo; "Chave inválida" quando o erro foi o 190; "Não configurada" sem a variável), contas com a chave liga/desliga e o aviso "Moeda X: fora dos totais" quando não for BRL, tabela das últimas 10 importações (data e hora em São Paulo, origem, período, registros, situação e erro em texto quebrado por linha), botão "Atualizar agora" (com "Importando… pode levar alguns minutos na primeira vez") e o link para o runbook.
- [ ] **Step 3: Run** `npm run typecheck`, `npx eslint` nos arquivos e `npx next build --webpack` — Expected: PASS, com `/api/cron/[tarefa]` e `/comercial/integracao-meta` nas rotas.
- [ ] **Step 4: Commit** — `feat(comercial): rota de cron, "Atualizar agora" e tela da integração Meta`.

---

### Task 6: Runbook, docs, revisão, publicação e configuração com o usuário

**Files:**
- Create: `docs/runbooks/meta-ads.md` (spec, seção 8, em passos curtos e numerados, com o que clicar no Business Manager)
- Modify: `docs/modulos/comercial.md` (entidades, tela, importação), `docs/02-arquitetura.md` (job `importar-meta-ads`, Meta Ads com usuário do sistema em vez de OAuth), `docs/04-seguranca-permissoes.md` (as 3 permissões)

- [ ] **Step 1: Write** o runbook e os docs.
- [ ] **Step 2: Run** typecheck, test, eslint e build — Expected: PASS.
- [ ] **Step 3: Commit** — `docs(comercial): runbook e documentação do Meta Ads`.
- [ ] **Step 4: Revisão final** por revisor independente (Review Focus acima); corrigir Críticos e Importantes com teste RED→GREEN.
- [ ] **Step 5: Push** (ver Global Constraints sobre commits de outras sessões) e acompanhar `hosting_get-deployment` até `completed`, com a migration aplicada.
- [ ] **Step 6: Configuração com o usuário**, um passo por vez, seguindo o runbook: app da Meta → usuário do sistema → chave → o usuário cola a chave em `META_ACCESS_TOKEN` no painel da Hostinger (Claude nunca recebe a chave) → conferir pelo conector se `CRON_SECRET` existe (só o nome, valores vêm mascarados) e, se faltar, combinar com o usuário como criar → nova publicação → criar o cron das 4h pelo conector, com aprovação → "Atualizar agora" → conferir a tela da integração.
