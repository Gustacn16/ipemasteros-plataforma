# WhatsApp — Entrega 3 (resumo dos grupos com IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todo dia, às 8h, cada grupo monitorado já tem o resumo de ontem feito pela IA. O gasto de IA do WhatsApp fica dentro de um limite próprio.

**Architecture:**
- **Criação do lote:** o cron `ia-whatsapp` (4h30 de Brasília) monta um pedido por grupo monitorado que teve mensagem ontem. Grava um `ResumoGrupo` pendente para cada pedido e envia **um** lote para a Message Batches API (`LoteIa`).
- **Coleta:** o cron `coletar-ia-whatsapp` (a cada 15 min) busca os lotes abertos, valida a saída estruturada e grava o resumo. Também registra o uso em `UsoIa` com `origem: "whatsapp"` e preço de lote (50%).
- **Limites por origem:** o Nexu passa a somar só a origem `nexu`. O WhatsApp tem limite próprio em `ConfiguracaoWhatsapp`.

**Tech Stack:**
- Next.js 16, Prisma 7 + MySQL, Zod 4 e Vitest.
- `@anthropic-ai/sdk` (já instalado, ^1.9): `client.messages.batches.create / retrieve / results`, com `output_config: { format: { type: "json_schema", schema } }`.

**Spec:**
- `docs/superpowers/specs/2026-11-18-whatsapp-ia-e-atendimento-design.md`, seções 6, 10, 11 e 13;
- spec base `docs/superpowers/specs/2026-11-17-whatsapp-design.md`, seções 6 (`ResumoGrupo`, `LoteIa`, `ConfiguracaoWhatsapp`) e 8.

## Global Constraints
- **Consultas:** nunca usar `contains`, `startsWith` ou `endsWith` no Prisma (dá 1267 de collation no MySQL da Hostinger). Os mocks de banco lançam erro se receberem isso.
- **Logs:** nunca registrar texto de mensagem, nome, telefone ou JID. Erro vai para o log só com `descreverErro` (`@/modulos/nexu/servicos/descrever-erro`).
- **Para a IA:**
  - vão só o texto e o nome do contato (`nomeExibido`), nunca telefone nem JID;
  - quem é da equipe (`deMim`, ou contato com `usuarioId`) aparece como `Nome (equipe)`;
  - mensagem própria (`deMim`) aparece como `Equipe IPEMaster (equipe)`.
- **Modelo e parâmetros:** `claude-opus-5-5`, guardado em `ConfiguracaoWhatsapp.modelo`. Omita `thinking` (no Opus 5.5 ele está sempre ligado). Use `output_config.effort: "medium"` e `max_tokens: 16000` (o raciocínio do Opus 5.5 conta; a estimativa do orçamento usa 4000).
- **Limites:**
  - WhatsApp `limiteMensalMicroUsd = 80_000_000` (US$ 80);
  - Nexu continua com US$ 20, mas passa a somar só `origem = "nexu"`;
  - o mês segue o calendário de São Paulo (`inicioDoMesSaoPaulo`).
- **Preço:** pedido feito em lote custa **50%** do preço normal em todos os tipos de token.
- **"Ontem":** é o dia de São Paulo (UTC-3 fixo), de `inicioDoDiaSaoPaulo(agora) - 24h` até `inicioDoDiaSaoPaulo(agora)`. O campo `dia` (`@db.Date`) guarda a data de São Paulo.
- **Retenção:** resumos de grupo ficam **365 dias** e depois são apagados pelo `limpar-whatsapp`.
- **Crons (criados pelo Gustavo no hPanel; servidor em UTC):**
  - `30 7 * * *` → `/api/cron/ia-whatsapp`;
  - `*/15 * * * *` → `/api/cron/coletar-ia-whatsapp`.
- **Commits:** só os arquivos da tarefa, `git commit -m ... -- <arquivos>`. Nunca `git add -A`.

## Review Focus
1. **O cron `ia-whatsapp` roda duas vezes no mesmo dia** (retry do hPanel): não cria um segundo lote nem duplica resumos (`@@unique([conversaId, dia])`), e não paga duas vezes. → Tarefa 4.
2. **Lote em que parte dos pedidos falha ou expira, ou em que a IA recusa (`stop_reason: "refusal"`):** só aqueles resumos ficam `falhou` com o motivo; o resto é gravado e o lote é encerrado. → Tarefa 5.
3. **JSON da IA que não passa no Zod** (campo faltando, pendência sem hora): fica `falhou` com "Resposta fora do formato.", sem derrubar a coleta. → Tarefa 5.
4. **Limite do mês quase no fim:** entram só os grupos que cabem no estimado restante, os com mais mensagens primeiro. Os outros ficam `falhou` com "Limite mensal de IA do WhatsApp atingido.". → Tarefa 4.
5. **Grupo muito movimentado** (milhares de mensagens): a entrada é cortada para no máximo 120.000 caracteres, mantendo as mensagens mais recentes, e a entrada avisa que houve corte. → Tarefa 3.

---

### Task 1: Custo de lote e limite por origem (`src/lib/ia`)

**Files:**
- Modify: `src/lib/ia/precos.ts`, `src/lib/ia/uso.ts`
- Test: `src/lib/ia/precos.test.ts`, `src/lib/ia/uso.test.ts`

**Interfaces:**
- Produces:
  - `calcularCustoMicroUsd(modelo: ModeloIa, t: TokensUso, opcoes?: { lote?: boolean }): number`, que com `lote: true` aplica metade do preço e arredonda para cima no fim;
  - `registrarUsoIa(d: DadosUso & { lote?: boolean })`;
  - `gastoMesMicroUsd(origem: string, agora?: Date): Promise<number>`.
- `situacaoLimites` (Nexu) passa a usar `gastoMesMicroUsd("nexu", agora)`.

- [ ] **Step 1: Escreva os testes:**
  - `"lote custa metade: Opus 1M entrada + 1M saída = 12_000_000 µUSD"`, sabendo que o preço normal é 24_000_000;
  - `"gasto do mês do Nexu ignora a origem whatsapp"`;
  - `"registrarUsoIa com lote grava o custo pela metade"`.
- [ ] **Step 2:** Rode `npx vitest run src/lib/ia`. Esperado: FAIL.
- [ ] **Step 3: Implemente.** No `registrarUsoIa`, não mude a assinatura que o Nexu já usa: `lote` é opcional e o padrão é `false`.
- [ ] **Step 4:** Rode `npx vitest run src/lib/ia src/modulos/nexu` e `npm run typecheck`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(ia): preço de lote e limite do mês por origem`.

### Task 2: Modelos de banco e configuração do WhatsApp

**Files:**
- Modify: `prisma/schema.prisma`
- Create:
  - `prisma/migrations/20261118100000_whatsapp_resumos/migration.sql`. Gere com `npx prisma migrate diff --from-schema <schema do HEAD salvo num arquivo temporário> --to-schema prisma/schema.prisma --script`; não há banco local, e a linha "Loaded Prisma config" deve ser removida;
  - `src/modulos/whatsapp/servicos/configuracao.ts`, `src/modulos/whatsapp/servicos/configuracao.test.ts`.

**Interfaces:**
- Produces:
  - `ConfiguracaoWhatsapp`: `id` (`"unica"`), `modelo` VarChar(60), `limiteMensalMicroUsd` Int, `atualizadoPorId?`, `atualizadoEm`;
  - `LoteIa`: `id`, `idExterno` VarChar(100) único, `tipo` (enum `TipoLoteIa`: `resumo_grupo`, `avaliacao`), `dia` `@db.Date`, `situacao` (enum `SituacaoLoteIa`: `aberto`, `concluido`, `falhou`), `erro?` VarChar(255), `criadoEm`, `concluidoEm?`;
  - `ResumoGrupo`:
    - campos: `id`, `conversaId` (FK `ConversaWhatsapp`, onDelete Cascade), `dia` `@db.Date`, `loteId?` (FK `LoteIa`, SetNull), `resumo` Text?, `temas` Json?, `pendencias` Json?, `destaques` Json?, `participacao` Json, `totalMensagens` Int, `modelo` VarChar(60), `situacao` (enum `SituacaoResumo`: `pendente`, `pronto`, `falhou`), `erro?` VarChar(255), `criadoEm`, `atualizadoEm`;
    - `@@unique([conversaId, dia])`, `@@index([dia])`, `@@map("resumos_grupo")`.
  - `obterConfiguracaoWhatsapp(): Promise<{ modelo: ModeloIa; limiteMensalMicroUsd: number }>`. Sem linha, devolve `{ modelo: "claude-opus-5-5", limiteMensalMicroUsd: 80_000_000 }`.
  - `salvarConfiguracaoWhatsapp(dados: { limiteMensalMicroUsd: number }, atorId: string): Promise<void>`. Faz upsert, aceita de 0 a 500_000_000 e audita `whatsapp.configuracao_alterada` (adicione a `AcaoAuditoria`).

- [ ] **Step 1: Escreva os testes** do serviço:
  - `"sem linha devolve opus e US$ 80"`;
  - `"modelo desconhecido cai no padrão"`;
  - `"salvar fora de 0..500_000_000 lança"`;
  - `"salvar audita só o valor, sem outros dados"`.
- [ ] **Step 2:** Rode os testes. Esperado: FAIL.
- [ ] **Step 3: Implemente** o schema, gere a migration e escreva o serviço. `npx prisma generate` e `npm run typecheck` devem passar.
- [ ] **Step 4:** Rode `npx vitest run src/modulos/whatsapp`. Esperado: PASS.
- [ ] **Step 5:** Atualize `docs/modulos/whatsapp.md` (entidades) e `docs/03-modelo-de-dados.md` (mapa).
- [ ] **Step 6: Commit** `feat(whatsapp): modelos de resumo, lote de IA e configuração`.

### Task 3: Montagem do pedido de resumo (regra pura)

**Files:**
- Create:
  - `src/modulos/whatsapp/ia/resumo-grupo.ts`, `src/modulos/whatsapp/ia/resumo-grupo.test.ts`;
  - `src/modulos/whatsapp/regras/dia.ts`, `src/modulos/whatsapp/regras/dia.test.ts`.

**Interfaces:**
- Consumes: `inicioDoDiaSaoPaulo` de `@/lib/ia/limites`.
- Produces:
  - `janelaDeOntem(agora: Date): { dia: Date; inicio: Date; fim: Date }`. `dia` é a meia-noite UTC da data de São Paulo, para gravar em `@db.Date`.
  - `type MensagemParaResumo = { enviadaEm: Date; autor: string; equipe: boolean; tipo: string; texto: string | null }`.
  - `montarEntradaResumo(grupo: { nome: string | null; turma: string | null }, mensagens: MensagemParaResumo[]): { texto: string; cortada: boolean }`:
    - cada linha é `[hh:mm] Autor: texto`, com `(equipe)` depois do nome quando for da equipe, e hora de São Paulo;
    - mídia sem texto vira `[áudio]`, `[imagem]` e assim por diante, como na tela;
    - o limite é de **120.000 caracteres**, mantendo as mais recentes;
    - quando corta, a entrada começa com `(Mensagens mais antigas do dia foram omitidas.)`.
  - `participacaoDoDia(mensagens): { autor: string; mensagens: number }[]`, em ordem decrescente e só com quem não é da equipe.
  - `ESQUEMA_RESUMO`: o JSON Schema da saída (`resumo` string; `temas` string[] até 6; `pendencias` `{ autor: string, hora: "hh:mm", texto: string }[]` até 15; `destaques` string[] até 5), com `additionalProperties: false`.
  - `esquemaZodResumo`: o mesmo formato em Zod, para validar o resultado.
  - `INSTRUCOES_RESUMO`: string com o system prompt em português. Ele pede:
    - resumo em até 5 frases;
    - os temas;
    - as dúvidas e reclamações de alunos **sem resposta** da equipe até o fim do dia;
    - os destaques;
    - nunca inventar o que não está nas mensagens.
  - `pedidoResumo(customId: string, modelo: ModeloIa, entrada: string)`: devolve o objeto `{ custom_id, params }` do lote com `system`, `messages`, `max_tokens: 16000` (o raciocínio do Opus 5.5 conta; a estimativa do orçamento usa 4000), `output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_RESUMO } }`.

- [ ] **Step 1: Escreva os testes:**
  - `"janelaDeOntem às 02:00 UTC de 19/11 (23h do dia 18 em SP) devolve o dia 17"`;
  - `"linha da equipe leva (equipe) e mensagem própria vira Equipe IPEMaster (equipe)"`;
  - `"áudio sem texto vira [áudio]"`;
  - `"entrada acima de 120.000 caracteres é cortada nas mais antigas e avisa"`;
  - `"participação conta só quem não é da equipe, em ordem decrescente"`;
  - `"pedido não tem telefone nem JID"`: monte com autores fictícios e confira que nenhum dígito de telefone de 10 ou mais algarismos aparece;
  - `"Zod recusa pendência sem hora"`.
- [ ] **Step 2:** Rode os testes. Esperado: FAIL.
- [ ] **Step 3: Implemente.**
- [ ] **Step 4:** Rode os testes. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): montagem do pedido de resumo de grupo`.

### Task 4: Criar o lote do dia (`ia-whatsapp`)

**Files:**
- Create: `src/modulos/whatsapp/servicos/lote-ia.ts`, `src/modulos/whatsapp/servicos/lote-ia.test.ts`
- Modify: `src/app/api/cron/[tarefa]/route.ts` (tarefa `ia-whatsapp`)

**Interfaces:**
- Consumes:
  - Tarefa 1: `gastoMesMicroUsd`, `calcularCustoMicroUsd`;
  - Tarefa 2: `obterConfiguracaoWhatsapp` e os modelos;
  - Tarefa 3: `janelaDeOntem`, `montarEntradaResumo`, `participacaoDoDia`, `pedidoResumo`;
  - `obterClienteAnthropic()` de `@/lib/ia/cliente`.
- Produces:
  - `type ClienteLotes = { criar(requisicoes: unknown[]): Promise<{ id: string }>; buscar(id: string): Promise<{ processing_status: string }>; resultados(id: string): AsyncIterable<ResultadoLote> }`, com um adaptador `clienteLotesAnthropic(cliente: Anthropic): ClienteLotes`;
  - `criarLoteDoDia(agora?: Date, cliente?: ClienteLotes | null): Promise<{ criado: boolean; pedidos: number; semVerba: number; motivo?: "sem_chave" | "ja_existe" | "nada_a_fazer" }>`.

- [ ] **Step 1: Escreva os testes**, com um cliente falso que guarda as requisições:
  - `"sem ANTHROPIC_API_KEY (cliente null) não faz nada: motivo sem_chave"`;
  - `"já existe LoteIa resumo_grupo do dia: motivo ja_existe, nenhuma requisição"`;
  - `"um pedido por grupo monitorado com mensagem ontem; grupo não monitorado ou sem mensagem fica fora"`;
  - `"cria ResumoGrupo pendente com participação e totalMensagens antes de enviar; custom_id = resumo:<id>"`;
  - `"verba restante só cabe em 1 dos 2 grupos: entra o de mais mensagens, o outro fica falhou com o texto do limite"`. A estimativa por pedido é `calcularCustoMicroUsd(modelo, { entrada: ceil(caracteres/3), saida: 8000, ... }, { lote: true })`;
  - `"falha ao criar o lote: resumos do dia viram falhou e nada de LoteIa"`.
- [ ] **Step 2:** Rode os testes. Esperado: FAIL.
- [ ] **Step 3: Implemente.**
  - A trava contra execução dupla é a busca por `LoteIa` com `tipo: "resumo_grupo"` e o `dia`. Depois de enviar, `upsert` o `ResumoGrupo` por `(conversaId, dia)`, só se ainda não estiver `pronto`.
  - Mensagens do grupo: `enviadaEm` na janela, ordenadas, com contato (`nomeExibido`, `usuarioId`).
  - O nome segue a regra 9 da tela, mas sem telefone: sem nome, use `Participante`.
- [ ] **Step 4: Ligue a tarefa no cron:** `"ia-whatsapp": async () => ({ ok: true, ...(await criarLoteDoDia()) })`.
- [ ] **Step 5:** Rode os testes e `npm run typecheck`. Esperado: PASS.
- [ ] **Step 6: Commit** `feat(whatsapp): lote diário de resumos de grupo`.

### Task 5: Coletar os resultados (`coletar-ia-whatsapp`)

**Files:**
- Modify:
  - `src/modulos/whatsapp/servicos/lote-ia.ts`, `src/modulos/whatsapp/servicos/lote-ia.test.ts`;
  - `src/app/api/cron/[tarefa]/route.ts` (tarefa `coletar-ia-whatsapp`).

**Interfaces:**
- Consumes: Tarefa 4 (`ClienteLotes`), Tarefa 3 (`esquemaZodResumo`), Tarefa 1 (`registrarUsoIa` com `lote: true`, `origem: "whatsapp"`, `usuarioId: null`, `inicioPergunta: false`).
- Produces: `coletarLotes(agora?: Date, cliente?: ClienteLotes | null): Promise<{ lotes: number; prontos: number; falhos: number }>`.

- [ ] **Step 1: Escreva os testes:**
  - `"lote ainda processando: nada muda"`;
  - `"succeeded com JSON válido: resumo pronto com temas, pendências e destaques; registra uso de lote"`;
  - `"stop_reason refusal: falhou com 'A IA recusou este resumo.'"`;
  - `"JSON fora do formato: falhou com 'Resposta fora do formato.'"`;
  - `"errored e expired: falhou com 'Erro da IA.' e 'O pedido expirou.'"`;
  - `"custom_id de resumo já pronto não é regravado (coleta repetida)"`;
  - `"no fim, LoteIa concluido com concluidoEm"`;
  - `"lote aberto há mais de 25 h vira falhou e seus resumos pendentes também"`.
- [ ] **Step 2:** Rode os testes. Esperado: FAIL.
- [ ] **Step 3: Implemente.**
  - O texto da resposta é o primeiro bloco `type: "text"` de `message.content`. Faça `JSON.parse` e depois `esquemaZodResumo.safeParse`.
  - Registre o uso de todo `succeeded`, inclusive dos recusados.
  - Erro inesperado em um item: logue `descreverErro`, deixe o item como `falhou` e siga para o próximo.
- [ ] **Step 4: Ligue a tarefa no cron:** `"coletar-ia-whatsapp": async () => ({ ok: true, ...(await coletarLotes()) })`.
- [ ] **Step 5:** Rode os testes e `npm run typecheck`. Esperado: PASS.
- [ ] **Step 6: Commit** `feat(whatsapp): coleta dos resumos do lote`.

### Task 6: Telas, retenção e documentação

**Files:**
- Modify:
  - `src/modulos/whatsapp/servicos/conversas.ts` (resumo do dia no detalhe do grupo e contagem de pendências de ontem na lista);
  - `src/modulos/whatsapp/componentes/lista-grupos.tsx`, `src/app/(app)/whatsapp/conversas/[id]/page.tsx`;
  - `src/modulos/whatsapp/servicos/saude.ts` e `src/app/(app)/admin/saude/page.tsx` (cartão de IA);
  - `src/modulos/whatsapp/servicos/limpeza.ts` (resumos com mais de 365 dias);
  - `docs/modulos/whatsapp.md`, `docs/runbooks/whatsapp-motor-vps.md` (os dois crons novos).
- Create:
  - `src/modulos/whatsapp/componentes/resumo-grupo.tsx`;
  - a ação `salvarLimiteIaWhatsappAcao` em `src/modulos/whatsapp/acoes/numeros.ts`.
- Test: `conversas.test.ts`, `saude.test.ts`, `limpeza.test.ts`.

**Interfaces:**
- Consumes: os modelos da Tarefa 2, `obterConfiguracaoWhatsapp` e `salvarConfiguracaoWhatsapp`, e `gastoMesMicroUsd("whatsapp")`.
- Produces:
  - `resumoDoGrupo(conversaId: string, dia: Date): Promise<ResumoTela | null>`;
  - `listarGrupos` ganha `pendenciasOntem: number | null` em cada grupo;
  - `saudeWhatsapp` ganha `ia: { configurada: boolean; gastoMesMicroUsd: number; limiteMensalMicroUsd: number }`;
  - `limparWhatsapp` ganha `resumosAntigos: number` no retorno.

- [ ] **Step 1: Escreva os testes:**
  - `"resumoDoGrupo devolve pronto com pendências; falhou devolve situacao e erro"`;
  - `"listarGrupos traz pendenciasOntem do resumo pronto de ontem, null sem resumo"`;
  - `"saúde traz gasto do mês só da origem whatsapp e o limite"`;
  - `"limpeza apaga resumos com dia anterior a 365 dias e conta resumosAntigos"`.
- [ ] **Step 2:** Rode os testes. Esperado: FAIL.
- [ ] **Step 3: Implemente:**
  - **Detalhe do grupo** (`/whatsapp/conversas/[id]` quando é grupo): seletor de dia em `?dia=AAAA-MM-DD` (padrão ontem) e um painel acima das mensagens com:
    - **Resumo**;
    - **Temas** (etiquetas);
    - **Sem resposta**, na forma `"texto" — autor, hh:mm`;
    - **Destaques**;
    - **Quem mais falou** (participação).
  - **Situação do resumo:** pendente mostra "O resumo deste dia ainda está sendo preparado."; falhou ou sem resumo mostra "Sem resumo neste dia.".
  - **Lista de grupos:** coluna "Pendências de ontem" (número, ou "—").
  - **`/admin/saude`:** cartão "IA do WhatsApp" com "Gasto do mês: US$ X de US$ Y". Sem a chave, mostra "IA não configurada: falta ANTHROPIC_API_KEY.". Para o admin, um campo para mudar o limite (em US$, convertido para micro), usando `salvarLimiteIaWhatsappAcao` com a permissão `whatsapp:gerenciar_numeros`.
  - **Limpeza:** apague `ResumoGrupo` com `dia` anterior a `agora - 365 dias`.
- [ ] **Step 4:** Rode todos os testes, `npm run typecheck` e `npx eslint src/modulos/whatsapp src/lib/ia "src/app/(app)/admin/saude"`. Esperado: PASS.
- [ ] **Step 5: Documente:**
  - **`docs/modulos/whatsapp.md`:** a regra do resumo diário, as telas e a retenção de 1 ano.
  - **Runbook:** uma seção "Crons da IA" com as duas linhas do hPanel. Use o mesmo formato `curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/<tarefa>` dos outros crons.
- [ ] **Step 6: Commit** `feat(whatsapp): resumo do grupo na tela, gasto de IA na saúde e retenção de 1 ano`.

---

**Fora desta entrega:**
- Avaliação das conversas e temperatura (entrega 5). O `LoteIa.tipo` já prevê `avaliacao`.
- Tempos de resposta e tempo da CS (entrega 4).
- O campo `time` do número (entrega 4).
