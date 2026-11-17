# WhatsApp — Entrega 2a: captura de conversas e mensagens. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Com um número conectado, o sistema guarda os grupos, os contatos e as mensagens de texto; o admin escolhe quais grupos acompanhar e liga cada grupo a uma turma; as conversas individuais ganham categoria; mensagens antigas e provisórias são apagadas sozinhas.

**Architecture:** O motor passa a ouvir o histórico (`messaging-history.set`), as mensagens novas (`messages.upsert`) e a lista de grupos (`groupFetchAllParticipating`), converte tudo para dois eventos novos (`conversas` e `mensagens`) e manda pelo mesmo `POST /api/whatsapp/motor/eventos`. O sistema decide o que guarda (regras puras), deduplica por id e liga contatos a alunos e usuários pelo telefone. Telas novas: Grupos e Conversas. Um cron diário limpa o provisório e o que passou da retenção.

**Tech Stack:** o mesmo da entrega 1 (Next.js 16, Prisma 7/MySQL, Zod 4, Vitest; motor Node + `baileys` 6.7.24).

**Spec:** `docs/superpowers/specs/2026-11-17-whatsapp-design.md` — seções 6 (`ContatoWhatsapp`, `ConversaWhatsapp`, `NumeroNoGrupo`, `MensagemWhatsapp`), 7 regras 4–6, 5a e 8, 10 (retenção, mínimo de dados, logs) e 11 (permissões). A entrega 2b (VPS, runbook, `/admin/saude`, textos de LGPD, trava de instância única do motor, logger do Baileys, `libsignal` por git, pedido do titular para apagar tudo de um telefone, e retenção de 1 ano para resumos) tem plano próprio.

## Global Constraints
- Tudo em português. Conventional Commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Várias sessões usam a pasta: commite só os seus arquivos; nunca `git add -A`, stash, reset, troca de branch ou push. Branch `teste`.
- Prisma: `git status --short prisma/` vazio antes de editar; migration por `prisma migrate diff`, timestamp depois da última existente.
- **Só texto:** guarda texto e legenda; mídia nunca é baixada (só o tipo: `imagem`, `audio`, `video`, `documento`, `figurinha`, `outro`). Texto cortado em 4000 caracteres.
- **Nunca** registrar em log texto de mensagem, telefone, JID, nome de contato ou QR — nem no motor nem no sistema. Auditoria só com ids e nomes de campos.
- Grupo é único por `jid` (sem duplicar quando vários números da empresa estão nele). Individual é único por (`numeroId`, `jid`). Mensagem é única por (`conversaId`, `idExterno`).
- Histórico: só os últimos **30 dias**. Mensagens de grupo **não monitorado** vindas do histórico ficam **48 h** (provisórias); mensagens ao vivo de grupo não monitorado **não são salvas**.
- Retenção: mensagens apagadas após **90 dias** (constante `DIAS_RETENCAO = 90`; a tela de configuração fica para depois).
- Conversas ignoradas sempre: `status@broadcast`, canais (`@newsletter`), e mensagens de protocolo, reação, enquete-voto e "mensagem apagada".
- Contrato motor ↔ sistema continua com `Authorization: Bearer $MOTOR_WHATSAPP_SEGREDO`; lote ≤ 500 eventos.

## Review Focus
1. **9º dígito:** o WhatsApp entrega números brasileiros com ou sem o 9 (`556281707432`), e o cadastro tem `62981707432` ou `(62) 98170-7432`. Os dois têm que casar com o mesmo aluno/usuário (teste em Task 2).
2. **Mesmo grupo em dois números:** a mesma mensagem chega pelos dois; fica uma conversa e uma mensagem (teste em Task 4).
3. **Evento repetido:** o motor reenvia o lote quando a resposta falha; reaplicar não duplica nada (teste em Task 4).
4. **Autor sem telefone (LID):** contato é criado pelo `lid`, aparece com o nome do perfil e sem ligação com aluno, e passa a ser ligado quando um evento depois traz o telefone do mesmo `lid` (teste em Task 4).
5. **Marcar conversa como pessoal:** apaga as mensagens dela na hora e as próximas não são salvas (teste em Task 5).

---

### Task 1: Modelos de contato, conversa e mensagem

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_whatsapp_captura/migration.sql`

**Interfaces:**
- Produces (Prisma, colunas `snake_case` via `@map`, tabelas no plural):
  - `enum TipoConversaWhatsapp { grupo individual }`
  - `enum CategoriaConversaWhatsapp { aluno lead equipe pessoal outro }`
  - `enum TipoMensagemWhatsapp { texto imagem audio video documento figurinha outro }`
  - `model ContatoWhatsapp` → `contatos_whatsapp`: `id`, `telefone VarChar(20)? @unique` (só dígitos, como o WhatsApp entrega), `lid VarChar(40)? @unique`, `nomeExibido VarChar(100)?`, `alunoId String?` (relação `Aluno`, `onDelete: SetNull`), `usuarioId String?` (relação `Usuario`, `SetNull`), `criadoEm`, `atualizadoEm`.
  - `model ConversaWhatsapp` → `conversas_whatsapp`: `id`, `jid VarChar(60)`, `tipo`, `numeroId String?` (individual; relação `NumeroWhatsapp`), `nome VarChar(120)?`, `contatoId String?` (individual), `turmaId String?` (grupo; relação `Turma`, `SetNull`), `numeroEnvioId String?` (grupo; sem uso nesta entrega), `categoria @default(outro)`, `monitorada Boolean @default(false)`, `provisoriaAte DateTime?`, `ultimaMensagemEm DateTime?`, `criadoEm`, `atualizadoEm`; `@@unique([numeroId, jid])`; `@@index([tipo, monitorada])`; `@@index([jid])`. Unicidade de grupo por `jid` é garantida no serviço (MySQL permite vários `NULL` em `numeroId`), dentro de transação com trava (Task 4).
  - `model NumeroNoGrupo` → `numeros_no_grupo`: `numeroId`, `conversaId`, `criadoEm`; `@@id([numeroId, conversaId])`.
  - `model MensagemWhatsapp` → `mensagens_whatsapp`: `id`, `conversaId` (relação, `onDelete: Cascade`), `idExterno VarChar(100)`, `numeroId` (quem capturou primeiro), `contatoId String?` (autor), `deMim Boolean`, `tipo`, `texto Text?`, `respondeAIdExterno VarChar(100)?`, `enviadaEm DateTime`, `criadoEm`; `@@unique([conversaId, idExterno])`; `@@index([conversaId, enviadaEm])`; `@@index([enviadaEm])`.

- [ ] **Step 1:** `git status --short prisma/` vazio. Edite o schema (relações de volta em `Aluno`, `Usuario`, `Turma`, `NumeroWhatsapp`).
- [ ] **Step 2:** Gere o SQL com `prisma migrate diff` (schema do `HEAD` → schema novo) e confira que só cria as quatro tabelas, índices e chaves.
- [ ] **Step 3: Run** `npx prisma validate`, `npx prisma generate`, `npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(whatsapp): modelos de contato, conversa e mensagem`.

### Task 2: Regras puras da captura

**Files:**
- Create: `src/modulos/whatsapp/regras/captura.ts`, `src/modulos/whatsapp/regras/captura.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const DIAS_HISTORICO = 30;
  export const HORAS_PROVISORIO = 48;
  export const DIAS_RETENCAO = 90;
  /** Chave para casar telefones brasileiros com ou sem 55 e com ou sem o 9: DDD + últimos 8 dígitos. Fora do Brasil: os dígitos como vieram. null se tiver menos de 10 dígitos. */
  export function chaveTelefone(digitos: string | null | undefined): string | null;
  export function categoriaInicial(c: { alunoId: string | null; usuarioId: string | null }): "aluno" | "equipe" | "lead";
  export type DecisaoGuardar = "guardar" | "provisoria" | "descartar";
  /** grupo monitorado → guardar; grupo não monitorado: histórico → provisoria, ao vivo → descartar; individual pessoal → descartar; individual → guardar. */
  export function decidirGuardar(c: { tipo: "grupo" | "individual"; monitorada: boolean; categoria: string }, origem: "historico" | "ao_vivo"): DecisaoGuardar;
  export function dentroDoHistorico(enviadaEm: Date, agora: Date): boolean; // até 30 dias
  ```
- [ ] **Step 1: Write the failing tests:** `chaveTelefone("556281707432")`, `chaveTelefone("5562981707432")`, `chaveTelefone("62981707432")` e `chaveTelefone("6281707432")` dão o mesmo valor `"6281707432"`; `chaveTelefone("(62) 98170-7432".replace(/\D/g, ""))` também; `chaveTelefone("447911123456")` → `"447911123456"`; `chaveTelefone("123")` → `null`; `categoriaInicial({ alunoId: "a", usuarioId: null })` → `"aluno"`, `{ null, "u" }` → `"equipe"`, `{ null, null }` → `"lead"`; os seis casos de `decidirGuardar`; `dentroDoHistorico` com 29 dias → `true`, 31 → `false`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/regras/captura.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** em `captura.ts`. Brasil = começa com `55` e tem 12–13 dígitos, ou tem 10–11 dígitos (sem 55).
- [ ] **Step 4: Run** o mesmo. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): regras de captura (telefone, categoria, o que guardar)`.

### Task 3: Eventos novos do motor (contrato)

**Files:**
- Modify: `src/modulos/whatsapp/esquemas/motor.ts`, `src/modulos/whatsapp/esquemas/esquemas.test.ts`, `motor-whatsapp/src/tipos.ts` (cópia do tipo)

**Interfaces:**
- Produces (dois membros novos em `esquemaEventoMotor`):
  ```ts
  { tipo: "conversas", numeroId: string, conversas: Array<{ jid: string (≤60), tipo: "grupo" | "individual", nome?: string (≤120) }> (≤500) }
  { tipo: "mensagens", numeroId: string, origem: "historico" | "ao_vivo", mensagens: Array<{
      idExterno: string (≤100), jid: string (≤60, a conversa), autorJid?: string (≤60), autorTelefone?: string (só dígitos, 10–15),
      autorNome?: string (≤100), deMim: boolean, tipo: TipoMensagem, texto?: string (≤4000), respondeA?: string (≤100),
      enviadaEm: string (ISO 8601) }> (≤100) }
  ```
  `jid` aceito só se termina em `@g.us`, `@s.whatsapp.net` ou `@lid`.
  Tipos exportados (nos dois lados): `TipoMensagem` (os 7 valores do enum), `ConversaMotor` (item de `conversas`), `MensagemMotor` (item de `mensagens`), `EventoConversas`, `EventoMensagens`.
- [ ] **Step 1: Write the failing tests:** evento `conversas` válido passa; `mensagens` com 101 itens falha; texto com 4001 caracteres falha; `jid` `status@broadcast` falha; `enviadaEm` não-ISO falha; `autorTelefone` `"62 9999"` falha.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/esquemas`. Expected: FAIL.
- [ ] **Step 3: Implement** os dois esquemas e copie os tipos para `motor-whatsapp/src/tipos.ts`.
- [ ] **Step 4: Run** o mesmo e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): contrato dos eventos de conversas e mensagens`.

### Task 4: Serviço de captura no sistema

**Files:**
- Create: `src/modulos/whatsapp/servicos/captura.ts`, `src/modulos/whatsapp/servicos/captura.test.ts`
- Modify: `src/modulos/whatsapp/servicos/motor.ts` (o `aplicarEventos` chama a captura para `conversas` e `mensagens`), `src/modulos/whatsapp/servicos/motor.test.ts`

**Interfaces:**
- Consumes: Task 2 (regras), Task 3 (tipos do evento).
- Produces ("server-only"):
  ```ts
  export async function aplicarConversas(numeroId: string, conversas: EventoConversas["conversas"], agora: Date): Promise<void>;
  export async function aplicarMensagens(numeroId: string, origem: "historico" | "ao_vivo", mensagens: EventoMensagens["mensagens"], agora: Date): Promise<{ salvas: number; descartadas: number }>;
  export async function obterOuCriarContato(dados: { jid?: string; telefone?: string | null; nome?: string | null }): Promise<string>; // id
  ```
  Regras:
  - Grupo: procura por `jid` com `tipo = grupo`; cria se não existe (dentro de `$transaction`, com `SELECT ... FOR UPDATE`/`upsert` que impeça dois iguais em corrida — explique no comentário). Registra `NumeroNoGrupo` (idempotente). Atualiza `nome` quando vier.
  - Individual: `upsert` por (`numeroId`, `jid`); na criação, `contatoId` = contato do `jid` e `categoria` = `categoriaInicial` do contato.
  - Contato: busca por `lid` (jid `@lid`) ou pela `chaveTelefone` do telefone (compare chaves — o telefone guardado é o que o WhatsApp mandou). Quando chega telefone para um contato só com `lid`, completa. Liga a `Aluno` (chave de `Aluno.telefone`) e a `Usuario` (chave de `Usuario.whatsapp`) quando há exatamente um com a mesma chave; com mais de um, não liga. `nomeExibido` atualiza com o nome mais novo.
  - Mensagem: ignora fora de `dentroDoHistorico` quando `origem = historico`; `decidirGuardar` decide; `provisoria` grava e põe `provisoriaAte = agora + 48 h` na conversa se ainda nulo; `createMany` com `skipDuplicates` por (`conversaId`, `idExterno`); `deMim` = verdadeiro se veio `deMim` **ou** se o autor é um contato cujo telefone é de um `NumeroWhatsapp` não excluído; atualiza `ultimaMensagemEm` com a maior `enviadaEm`.
  - Mensagem de conversa ainda desconhecida cria a conversa (sem nome) antes.
- [ ] **Step 1: Write the failing tests** (banco em memória, como `motor.test.ts`): grupo recebido por dois números → 1 conversa e 2 `NumeroNoGrupo`; a mesma mensagem pelos dois números → 1 mensagem; reaplicar o mesmo lote → nada novo; mensagem ao vivo de grupo não monitorado → descartada; do histórico → salva e `provisoriaAte` = agora + 48 h; histórico de 31 dias atrás → ignorada; individual de contato com telefone `556281707432` e aluno com `62981707432` → contato ligado ao aluno e categoria `aluno`; autor `x@lid` sem telefone → contato só com `lid`, e um segundo evento com `autorJid` `x@lid` + `autorTelefone` completa o telefone e liga; dois alunos com a mesma chave → não liga; autor que é outro número da empresa → `deMim = true`; conversa `pessoal` → mensagens descartadas.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/servicos`. Expected: FAIL.
- [ ] **Step 3: Implement** `captura.ts` e ligue no `aplicarEventos` (cada evento `conversas`/`mensagens` conta como 1 aplicado; vaga inexistente/excluída → ignorado, como os outros).
- [ ] **Step 4: Run** o mesmo e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): captura de conversas, contatos e mensagens no sistema`.

### Task 5: Grupos e conversas na tela

**Files:**
- Create: `src/modulos/whatsapp/servicos/conversas.ts`, `src/modulos/whatsapp/servicos/conversas.test.ts`, `src/modulos/whatsapp/acoes/conversas.ts`, `src/modulos/whatsapp/componentes/lista-grupos.tsx`, `src/modulos/whatsapp/componentes/lista-conversas.tsx`, `src/modulos/whatsapp/componentes/mensagens-conversa.tsx`, `src/app/(app)/whatsapp/grupos/page.tsx`, `src/app/(app)/whatsapp/conversas/page.tsx`, `src/app/(app)/whatsapp/conversas/[id]/page.tsx`, `src/modulos/whatsapp/componentes/abas-whatsapp.tsx`
- Modify: `src/lib/permissoes.ts` (+ teste), `src/lib/auditoria.ts`, `src/app/(app)/whatsapp/page.tsx` (vai para a primeira aba que a pessoa pode ver), `src/app/(app)/layout.tsx` (o item do menu também aparece para `whatsapp:ver_grupos`/`whatsapp:ver_proprio`), `docs/modulos/whatsapp.md`, `docs/04-seguranca-permissoes.md`

**Interfaces:**
- Produces: permissões `whatsapp:ver_grupos` (admin, gestor), `whatsapp:ver_equipe` (admin, gestor), `whatsapp:ver_proprio` (comercial); auditoria `whatsapp.grupo_monitorado`, `whatsapp.categoria_alterada`, `whatsapp.conversa_aberta`.
  ```ts
  listarGrupos(ator): Promise<{ id; nome; monitorada; turma: { id; nome } | null; numeros: string[]; ultimaMensagemEm; totalMensagens7d: number }[]>
  definirMonitoramento(ator, conversaId, monitorada: boolean): Promise<void> // marcar: limpa provisoriaAte (vira definitiva); desmarcar: apaga as mensagens dela
  ligarTurma(ator, conversaId, turmaId: string | null): Promise<void>
  listarConversas(ator, filtro: { numeroId?: string; categoria?: Categoria }): Promise<...> // gestão vê todas; comercial só as dos próprios números
  definirCategoria(ator, conversaId, categoria): Promise<void> // pessoal: apaga as mensagens na mesma transação
  mensagensDaConversa(ator, conversaId, limite = 200): Promise<{ autor: string; deMim; tipo; texto; enviadaEm }[]> // audita quando a conversa é de número de outro dono
  ```
  Telas (abas no topo: Grupos · Conversas · Números, cada uma só para quem pode): **Grupos** — tabela com nome, números da empresa no grupo, mensagens nos últimos 7 dias, turma (seletor) e o interruptor "Acompanhar"; grupo provisório mostra "Histórico guardado até <data>"; ao desmarcar, confirma "As mensagens guardadas deste grupo serão apagadas." **Conversas** — filtro por número e categoria; categoria editável; clique abre as últimas 200 mensagens (texto ou "[áudio]", "[imagem]" etc.), com o nome do autor, nunca o telefone completo (mostra só os 4 últimos dígitos quando não há nome).
- [ ] **Step 1: Write the failing tests** em `conversas.test.ts` e `permissoes.test.ts`: comercial não vê grupos (`ErroPermissao`); comercial lista só conversas dos números dele; `definirCategoria(..., "pessoal")` apaga as mensagens da conversa; desmarcar grupo apaga as mensagens; marcar limpa `provisoriaAte`; gestor abrindo conversa de número de outro dono grava `whatsapp.conversa_aberta`; abrindo a própria, não grava; as três permissões por papel.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp src/lib/permissoes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** serviço, ações, componentes, páginas, docs.
- [ ] **Step 4: Run** `npx eslint src`, `npm run typecheck`, `npm run test`, e `DATABASE_URL="mysql://x:x@localhost:3306/x" npx next build --webpack`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): telas de grupos e conversas`.

### Task 6: Motor captura e envia

**Files:**
- Create: `motor-whatsapp/src/conversao.ts`, `motor-whatsapp/src/conversao.test.ts`
- Modify: `motor-whatsapp/src/conexoes.ts` (+ teste)

**Interfaces:**
- Consumes: tipos da Task 3 (cópia em `tipos.ts`).
- Produces:
  ```ts
  // conversao.ts — puro, sem socket
  export function converterMensagem(m: WAMessage): MensagemMotor | null; // null para o que é ignorado (Global Constraints)
  export function converterConversas(grupos: GroupMetadata[], chats: Chat[]): ConversaMotor[];
  export function emLotes<T>(itens: T[], tamanho: number): T[][];
  ```
  `converterMensagem`: usa `normalizeMessageContent`/`getContentType` da Baileys; texto de `conversation`, `extendedTextMessage.text` ou legenda (`caption`) de imagem/vídeo/documento; tipo por conteúdo; `idExterno = key.id`; `jid = key.remoteJid`; autor = `key.participant` (grupo) ou `remoteJid` (individual), e `autorTelefone` do JID quando for `@s.whatsapp.net` (use `telefoneDoJid`) ou do campo de telefone alternativo que a Baileys trouxer (leia os tipos de `WAMessageKey` na versão instalada); `autorNome = pushName`; `deMim = key.fromMe`; `respondeA` = `contextInfo.stanzaId`; `enviadaEm` de `messageTimestamp` (segundos → ISO).
  Em `conexoes.ts`: em `messaging-history.set` → eventos `conversas` (dos `chats`) e `mensagens` com `origem: "historico"`, em lotes de 100; em `messages.upsert` → `origem: "ao_vivo"` (tipos `notify` e `append`); ao abrir (`connection === "open"`), `groupFetchAllParticipating()` → evento `conversas`. Nada disso escreve em log além de contagens (`[conexoes] <numeroId>: 120 mensagens do histórico`).
- [ ] **Step 1: Write the failing tests** (`conversao.test.ts`, com objetos `WAMessage` montados à mão): texto simples; legenda de imagem → tipo `imagem` com texto; áudio → tipo `audio` sem texto; `status@broadcast` → `null`; reação → `null`; mensagem apagada (protocolo) → `null`; grupo com `participant` `@lid` → `autorJid` lid sem telefone; resposta → `respondeA`; texto com 5000 caracteres → cortado em 4000; `emLotes` de 250 em 100 → 100/100/50. Em `conexoes.test.ts` (Baileys mockado): `messaging-history.set` com 150 mensagens gera 2 eventos `mensagens` com `origem: "historico"`; `messages.upsert` gera `ao_vivo`.
- [ ] **Step 2: Run** `cd motor-whatsapp && npm test`. Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** `npm test` e `npx tsc --noEmit` no motor. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): motor captura conversas e mensagens`.

### Task 7: Limpeza diária (provisório e retenção)

**Files:**
- Create: `src/modulos/whatsapp/servicos/limpeza.ts`, `src/modulos/whatsapp/servicos/limpeza.test.ts`
- Modify: `src/app/api/cron/[tarefa]/route.ts` (tarefa `limpar-whatsapp`), `docs/02-arquitetura.md` (lista de jobs)

**Interfaces:**
- Produces: `limparWhatsapp(agora?: Date): Promise<{ provisorias: number; antigas: number }>` — apaga mensagens de grupos **não monitorados** com `provisoriaAte < agora` e zera `provisoriaAte`; apaga mensagens com `enviadaEm` mais velha que 90 dias. Em lotes de 5000 por `deleteMany` até acabar.
- [ ] **Step 1: Write the failing tests:** provisória vencida de grupo não monitorado é apagada; de grupo que virou monitorado não; mensagem de 91 dias é apagada e a de 89 não.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/servicos/limpeza.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** e registre a tarefa no cron.
- [ ] **Step 4: Run** o mesmo, `npm run typecheck`, `npm run test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): limpeza diária do provisório e da retenção`.

### Task 8: Teste com o Gustavo

- [ ] **Step 1:** Push com o OK dele. Ele cria o cron `limpar-whatsapp` no hPanel (diário, 3h) com o mesmo formato dos outros.
- [ ] **Step 2:** Como o histórico só chega no pareamento, ele **desconecta e lê o QR de novo** depois de atualizar o motor (`Ctrl + C` e `npm start` numa aba só).
- [ ] **Step 3:** Conferir com ele: a aba Grupos lista os grupos do número; marcar um grupo e ver as mensagens; uma mensagem nova num grupo marcado aparece em segundos; conversas individuais aparecem com categoria; marcar uma como pessoal some com as mensagens.
