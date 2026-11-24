# WhatsApp entrega 7: avisos nos grupos (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda segunda o sistema transforma a agenda da semana seguinte em rascunhos de aviso. O Gustavo aprova cada um, e o motor envia nos grupos no horário, com status por grupo.

**Architecture:**
- **Dados:** tabelas novas de aviso e de envio por grupo. A fila de comandos do motor ganha o tipo `enviar_grupo` e o campo `executarApos`.
- **Ciclo:** um cron a cada 5 min (`envios-whatsapp`) cuida de tudo:
  - gera os rascunhos da semana (às segundas, a partir das 7h);
  - devolve para rascunho os avisos cujo evento mudou;
  - transforma os avisos que chegaram na hora em comandos espaçados.
- **Motor:** passa a executar `enviar_grupo`. O site só entrega esse tipo a um motor que declarar que sabe enviar, porque o motor antigo trataria qualquer tipo desconhecido como "desconectar".
- **Tela:** a seção Grupos ganha a aba Avisos. Ajustes ganha "Avisos da agenda". A Visão geral ganha "Próximos envios".

**Tech Stack:** Next.js 16 (Server Components + server actions), Prisma 7/MySQL, Vitest, @anthropic-ai/sdk, motor Node com Baileys 6.7.24.

**Spec:** `docs/superpowers/specs/2026-11-24-whatsapp-central-avisos-api-oficial-design.md`: §6 inteiro, §11 itens 1, 2, 3 e 7, entrega 7 do §9.

## Global Constraints

### Banco e datas
- Nunca usar `contains`/`startsWith`/`endsWith` do Prisma.
- Datas: São Paulo é UTC-3 fixo. `EventoInstitucional.dataInicio` é `@db.Date` (meia-noite UTC do dia), e `horaInicio` é "HH:MM" de São Paulo.

### Regras de envio
- Entre dois envios do mesmo aviso: espera aleatória de **8 a 20 s**.
- Limites: no máximo **30 grupos por aviso** e **60 envios por número por dia** (dia de São Paulo, somando todos os avisos). O que passar do limite vira `falhou` com o erro "Limite de envios do dia atingido.".
- Horário: só entre **8h e 20h** de São Paulo. Na aprovação, `agendadoPara` precisa ser ≥ 8h, e `agendadoPara + grupos × 20 s` precisa ser ≤ 20h.
- Número que envia: só um número **conectado**, da finalidade `escola` e não excluído, que **está no grupo** (`NumeroNoGrupo`). Preferência pelo time `cs`; senão o primeiro por nome. Sem número: o envio fica `sem_numero` e não entra.
- O texto é só texto (sem mídia), com até **1.500 caracteres**.
- Nada é enviado sem aprovação. Cancelar só é possível antes do envio começar.
- Comando `enviar_grupo` **nunca é reentregue**: se ficar `em_andamento` mais de 2 min sem resposta, vira `falhou` com o erro "O motor não confirmou o envio.". Repetir arriscaria mandar duas vezes.

### Rascunhos e IA
- Rascunhos: toda segunda a partir das 7h de São Paulo, para os eventos de segunda a domingo da semana **seguinte**, cujo tipo tem `divulgarNosGrupos = true`. É um aviso por evento (único por `eventoId`). Evento excluído não gera aviso.
- Horário sugerido: véspera do evento às 9h de São Paulo.
- Grupos sugeridos, nesta ordem:
  1. grupos monitorados ligados à turma cujo nome bate com `EventoInstitucional.turma` (sem acento, minúsculo, espaços normalizados, igualdade exata, comparação em memória);
  2. se não houver, os grupos padrão do tipo;
  3. se não houver, nenhum.
- IA: modelo `claude-haiku-5-5` em chamada direta (`messages.create`), `max_tokens` 600, `output_config: { effort: "low" }`. Gasto registrado com `registrarUsoIa({ origem: "whatsapp", ... })` dentro do limite mensal do WhatsApp (`gastoMesMicroUsd("whatsapp")` < `limiteMensalMicroUsd`).
- Sem verba, chave ou resposta válida, usar o texto padrão:
  `"📢 {titulo}\n🗓️ {dia da semana}, {dd/mm}{ às HH:MM}\n{📍 local}\n{descrição curta}"`, montando só as linhas que existem.

### Evento que muda
- Evento de um aviso `aprovado` mudou (data, hora, título, local ou exclusão; comparar com o retrato guardado): o aviso volta a `rascunho` com o alerta "O evento mudou depois da aprovação. Confira e aprove de novo.". Se o evento foi excluído, o alerta é "O evento foi excluído.".
- Se já está `enviando`: cancela os comandos ainda `pendente` e marca os envios deles como `falhou` com o erro "Cancelado: o evento mudou.".

### Permissões, auditoria e commits
- Nova permissão `whatsapp:avisos` (admin e gestor), para ver, criar, editar, aprovar e cancelar avisos e mexer em "Avisos da agenda".
- Auditoria (`registrarAuditoria`) ao criar avulso, editar, aprovar, cancelar e mudar a configuração de tipos/grupos padrão. Nunca registrar o texto do aviso em log ou auditoria; registrar só id e contagens.
- Commits só dos arquivos da tarefa, por caminho. Mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca `git add -A`, stash, reset ou trocar de branch.
- Typecheck: `DATABASE_URL=mysql://u:p@127.0.0.1:3306/x npx next typegen && DATABASE_URL=mysql://u:p@127.0.0.1:3306/x npx tsc --noEmit`. Testes: `npx vitest run`. Motor: `cd motor-whatsapp && npx vitest run && npx tsc --noEmit`.

## Review Focus

1. **Motor antigo recebendo `enviar_grupo`:** ele trataria o comando como "desconectar" e derrubaria o número. O site só pode entregar esse tipo quando o motor manda `?recursos=enviar_grupo`.
2. **Cron rodando duas vezes ao mesmo tempo, ou motor buscando em paralelo:** nenhum grupo pode receber o mesmo aviso duas vezes. Valem o claim condicional (`updateMany` com condição de situação) e a unicidade de `eventoId`.
3. **Aviso aprovado para depois das 20h, ou com muitos grupos que estouram as 20h:** a aprovação é recusada com uma mensagem clara.
4. **Número desconectado entre a aprovação e o envio:** o envio fica `sem_numero` ou `falhou` com motivo, e o resto do aviso segue.
5. **Segunda sem eventos, tipo sem grupos padrão, evento sem turma:** a tela mostra o rascunho com "Escolha os grupos" e não quebra.

---

### Task 1: Banco, permissão e regras puras

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261124120000_whatsapp_avisos/migration.sql` (gerar com `npx prisma migrate diff --from-schema <schema do HEAD> --to-schema prisma/schema.prisma --script`; não existe banco local)
- Modify: `src/lib/permissoes.ts` (+ teste existente de permissões, se houver)
- Create: `src/modulos/whatsapp/regras/avisos.ts`
- Create: `src/modulos/whatsapp/regras/avisos.test.ts`

**Interfaces (produz):**
- Prisma:
  - `enum SituacaoAvisoGrupo { rascunho aprovado enviando concluido cancelado falhou }`
  - `enum OrigemAvisoGrupo { agenda avulso }`
  - `enum SituacaoEnvioAviso { aguardando enviado falhou sem_numero cancelado }`
  - `model AvisoGrupo` (`avisos_grupo`):
    - id, `eventoId String? @unique` (FK `EventoInstitucional`, `onDelete: SetNull`), `texto String @db.Text`, `agendadoPara DateTime`, `situacao SituacaoAvisoGrupo @default(rascunho)`, `origem OrigemAvisoGrupo`;
    - `retratoEvento Json?` (titulo, dataInicio ISO, horaInicio, local, no momento da aprovação);
    - `alerta String? @db.VarChar(255)`, `textoPorIa Boolean @default(false)`;
    - `aprovadoPorId String?`, `aprovadoEm DateTime?`, `criadoPorId String?` (null = sistema), `canceladoEm DateTime?`, `criadoEm`, `atualizadoEm`;
    - `@@index([situacao, agendadoPara])`.
  - `model EnvioAvisoGrupo` (`envios_aviso_grupo`):
    - id, `avisoId` (Cascade), `conversaId` (FK `ConversaWhatsapp`, Cascade), `numeroId String?`, `comandoId String? @unique`;
    - `situacao SituacaoEnvioAviso @default(aguardando)`, `erro String? @db.VarChar(255)`, `enviadoEm DateTime?`;
    - `@@unique([avisoId, conversaId])`.
  - `TipoEvento` ganha `divulgarNosGrupos Boolean @default(false) @map("divulgar_nos_grupos")`.
  - `model GrupoPadraoTipoEvento` (`grupos_padrao_tipo_evento`): `tipoId` + `conversaId` (os dois com Cascade), `@@id([tipoId, conversaId])`.
  - `TipoComandoWhatsapp` ganha `enviar_grupo`. `ComandoWhatsapp` ganha `executarApos DateTime? @map("executar_apos")`.
- Permissão `"whatsapp:avisos"` no tipo `Permissao` e em `WHATSAPP_GESTAO`.
- Exportações de `regras/avisos.ts`:
  - `ESPERA_MIN_S = 8`, `ESPERA_MAX_S = 20`, `MAX_GRUPOS_POR_AVISO = 30`, `MAX_ENVIOS_NUMERO_DIA = 60`, `MAX_TEXTO_AVISO = 1500`, `HORA_INICIO_ENVIO = 8`, `HORA_FIM_ENVIO = 20`.
  - `normalizarNome(s: string): string`
  - `semanaSeguinte(agora: Date): { inicio: Date; fim: Date }`: datas `@db.Date` de segunda e do domingo seguinte, em São Paulo.
  - `horarioSugerido(dataInicio: Date): Date`: véspera às 9h de São Paulo.
  - `validarJanela(agendadoPara: Date, grupos: number): string | null`: devolve a mensagem de erro ou `null`.
  - `atrasosEnvio(n: number, aleatorio?: () => number): number[]`: segundos acumulados; o primeiro é 0; cada intervalo entre 8 e 20.
  - `textoPadrao(e: { titulo: string; dataInicio: Date; horaInicio: string | null; local: string | null; descricao: string | null }): string`
  - `escolherNumero(numeros: { id: string; nome: string; time: TimeNumeroWhatsapp }[]): string | null`: prefere `cs`, senão o primeiro por nome.

- [ ] **Step 1: Testes que falham** em `avisos.test.ts`:
  - `normalizarNome("  Turma  Ávila 2026 ")` → `"turma avila 2026"`.
  - `semanaSeguinte(new Date("2026-11-24T13:00:00Z"))` (terça) → início `2026-11-30T00:00:00Z`, fim `2026-12-06T00:00:00Z`. Com a segunda `2026-11-30T10:00:00Z` → início `2026-12-07T00:00:00Z`.
  - `horarioSugerido(new Date("2026-12-03T00:00:00Z"))` → `2026-12-02T12:00:00Z`.
  - `validarJanela`:
    - às 10h SP com 30 grupos → `null`;
    - às 7h SP → mensagem com "8h";
    - às 19h55 SP com 30 grupos → mensagem com "20h";
    - 31 grupos → mensagem com "30 grupos";
    - 0 grupos → "Escolha ao menos um grupo.".
  - `atrasosEnvio(3, () => 0)` → `[0, 8, 16]`; `atrasosEnvio(3, () => 0.999999)` → cada passo ≤ 20.
  - `textoPadrao` sem hora, sem local e sem descrição → só as duas primeiras linhas. A quinta-feira `2026-12-03` aparece como "quinta-feira, 03/12".
  - `escolherNumero` com `[{comercial "A"}, {cs "Z"}]` → o id do cs; com uma lista vazia → `null`.
- [ ] **Step 2:** rodar o teste e ver FAIL.
- [ ] **Step 3:** implementar o schema, a migration, a permissão e as regras.
- [ ] **Step 4:** `npx prisma validate` (com o DATABASE_URL fictício), typecheck e `npx vitest run src/modulos/whatsapp src/lib` → PASS.
- [ ] **Step 5:** commit `feat(whatsapp): tabelas e regras dos avisos nos grupos`.

### Task 2: Rascunhos da semana (com IA)

**Files:**
- Create: `src/modulos/whatsapp/ia/texto-aviso.ts` (+ `.test.ts`)
- Create: `src/modulos/whatsapp/servicos/avisos-rascunho.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes: Task 1. `gastoMesMicroUsd`/`registrarUsoIa` (`@/lib/ia/uso`), `obterConfiguracaoWhatsapp()` (`servicos/configuracao.ts`) e o padrão de chamada de `src/modulos/espiao/servicos/ia.ts`.
- Produces:
  - `MODELO_AVISO = "claude-haiku-5-5"`.
  - `escreverAviso(evento, cliente: Pick<Anthropic, "messages"> | null, agora: Date): Promise<{ texto: string; porIa: boolean }>`. Usa a IA se houver cliente e verba, senão `textoPadrao`. Corta em `MAX_TEXTO_AVISO`. Nunca lança.
  - `gruposSugeridos(evento: { tipoId: string; turma: string | null }): Promise<string[]>`: ids de conversa (grupo, monitorada).
  - `gerarRascunhosDaSemana(agora: Date, cliente?: ...): Promise<{ criados: number; jaExistiam: number }>`. Só age se `agora` for segunda ≥ 7h em São Paulo. Fora disso devolve `{0,0}` sem consultar nada. Cria `AvisoGrupo` (origem `agenda`, `agendadoPara = horarioSugerido`, `textoPorIa`) e os `EnvioAvisoGrupo` `aguardando` dos grupos sugeridos. Um `P2002` em `eventoId` conta como `jaExistiam`.
- Instruções da IA (sistema), resumidas: escrever um aviso curto de escola para um grupo de WhatsApp de alunos de odontologia. Máximo 6 linhas, 1 ou 2 emojis, sem inventar informação, sem link, tratando por "vocês". Devolver só o texto.

- [ ] **Step 1: Testes que falham:**
  - `escreverAviso` com cliente mock devolvendo "Olá turma" → `{texto:"Olá turma", porIa:true}`, e `registrarUsoIa` é chamado com `origem:"whatsapp"`.
  - Sem verba (gasto ≥ limite) → `porIa:false`, cliente não chamado.
  - O cliente lança → `porIa:false`.
  - `gerarRascunhosDaSemana`:
    - numa terça → `{criados:0, jaExistiam:0}` e o prisma não é chamado;
    - na segunda 10h SP, com 2 eventos de tipo divulgável (um com turma "Turma Ávila" que bate com a turma "turma avila", outro sem turma e com tipo de grupos padrão `[g9]`) → 2 avisos, com grupos `[g1,g2]` (monitorados da turma) e `[g9]`;
    - rodar de novo com `create` lançando `P2002` → `jaExistiam: 2`.
- [ ] **Step 2:** rodar e ver FAIL. **Step 3:** implementar. **Step 4:** PASS + typecheck.
- [ ] **Step 5:** commit `feat(whatsapp): rascunhos de aviso a partir da agenda`.

### Task 3: Tela e ações dos avisos (sem envio)

**Files:**
- Create: `src/modulos/whatsapp/servicos/avisos.ts` (+ `.test.ts`)
- Create: `src/modulos/whatsapp/esquemas/aviso.ts`
- Create: `src/modulos/whatsapp/acoes/avisos.ts`

**Interfaces (produz):**
- `type AvisoNaTela = { id; texto; agendadoPara: Date; situacao; origem; alerta: string | null; textoPorIa: boolean; evento: { titulo: string; dataInicio: Date; horaInicio: string | null } | null; grupos: { conversaId; nome: string; situacao: SituacaoEnvioAviso; erro: string | null }[] }`
- `listarAvisos(ator, de: Date, ate: Date): Promise<AvisoNaTela[]>`: por `agendadoPara`; rascunhos antes.
- `listarGruposParaAviso(ator): Promise<{ id: string; nome: string }[]>`: grupos monitorados, por nome.
- `salvarAviso(ator, dados: unknown): Promise<{ id: string }>`:
  - cria um avulso (sem `id`) ou edita (com `id`);
  - só edita em `rascunho` ou `aprovado`, e editar um aprovado o devolve a `rascunho`;
  - substitui os `EnvioAvisoGrupo` pelos grupos escolhidos;
  - esquema zod: `id?`, `texto` com 1 a 1.500 caracteres, `agendadoPara` (string `YYYY-MM-DDTHH:MM` de São Paulo), `grupos` com 1 a 30 ids.
- `aprovarAviso(ator, id)`:
  - exige `rascunho`;
  - roda `validarJanela`;
  - grava o `retratoEvento` se houver evento;
  - claim condicional `updateMany where {id, situacao:"rascunho"}`.
- `aprovarTodos(ator, de, ate): Promise<{ aprovados: number; recusados: { id: string; motivo: string }[] }>`.
- `cancelarAviso(ator, id)`: só em `rascunho` ou `aprovado`. Marca os envios `cancelado`.
- Todas exigem `whatsapp:avisos` e auditam (ações `whatsapp.aviso.criar`, `.editar`, `.aprovar`, `.cancelar`, com `{ grupos: n }`).
- As ações em `acoes/avisos.ts` seguem o padrão de `acoes/numeros.ts` (`tratarErroAcao`) e chamam `revalidatePath("/whatsapp/avisos")` e `revalidatePath("/whatsapp/visao-geral")`.

- [ ] **Step 1: Testes que falham:**
  - `comercial` → `ErroPermissao` em todas.
  - `aprovarAviso`:
    - às 7h SP → `ErroNegocio` com "8h";
    - de um `enviando` → `ErroNegocio`;
    - corrida (o `updateMany` devolve count 0) → `ErroNegocio("Este aviso já mudou. Atualize a página.")`.
  - `salvarAviso` editando um aprovado → situação `rascunho`.
  - `aprovarTodos` com um válido e um sem grupos → 1 aprovado, 1 recusado com o motivo.
- [ ] **Step 2–4:** FAIL → implementar → PASS + typecheck.
- [ ] **Step 5:** commit `feat(whatsapp): criar, editar, aprovar e cancelar avisos`.

### Task 4: Envio: cron, fila e conclusão

**Files:**
- Create: `src/modulos/whatsapp/servicos/avisos-envio.ts` (+ `.test.ts`)
- Modify: `src/modulos/whatsapp/servicos/motor.ts` (+ teste existente)
- Modify: `src/app/api/whatsapp/motor/comandos/route.ts`
- Modify: `src/app/api/cron/[tarefa]/route.ts` (+ teste existente, se houver)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `conferirEventosMudados(agora): Promise<{ voltaram: number; interrompidos: number }>`: regras do bloco "Evento que muda" (Global Constraints).
  - `dispararAvisosDaHora(agora, aleatorio?): Promise<{ avisos: number; comandos: number; semNumero: number; acimaDoLimite: number }>`:
    - pega os `aprovado` com `agendadoPara <= agora` e faz claim para `enviando`;
    - para cada envio `aguardando`, escolhe o número (`escolherNumero` entre os conectados, `escola`, no grupo) e aplica o limite do dia por número (conta comandos `enviar_grupo` do número com `criadoEm` no dia SP);
    - cria um `ComandoWhatsapp { tipo:"enviar_grupo", numeroId, executarApos: agora + atraso, dados: { jid, texto, envioId } }` e grava `comandoId`/`numeroId` no envio;
    - um aviso sem nenhum comando criado vira `falhou`.
  - Cron `"envios-whatsapp"`: roda em sequência `gerarRascunhosDaSemana` → `conferirEventosMudados` → `dispararAvisosDaHora` e devolve só contagens.
  - `entregarComandos(agora, opcoes: { recursos?: string[] } = {})`:
    - só entrega comandos com `executarApos` null ou `<= agora`;
    - `enviar_grupo` só sai se `recursos` incluir `"enviar_grupo"`, e no máximo 1 por `numeroId` por chamada;
    - `enviar_grupo` preso em `em_andamento` há mais de 2 min vira `falhou` com "O motor não confirmou o envio." (nunca é reentregue);
    - o retorno inclui `dados` para `enviar_grupo`.
  - A rota GET lê `recursos` da query (`?recursos=enviar_grupo`, separados por vírgula).
  - `concluirComando` para `enviar_grupo`:
    - atualiza o envio (`enviado` + `enviadoEm`, ou `falhou` + erro);
    - quando nenhum envio do aviso estiver mais `aguardando`, o aviso vira `concluido` se ao menos um foi `enviado`, senão `falhou`.

- [ ] **Step 1: Testes que falham:**
  - `entregarComandos` sem `recursos` não entrega `enviar_grupo` e o deixa `pendente`.
  - Com `recursos:["enviar_grupo"]`, 3 comandos do mesmo número → entrega 1.
  - `executarApos` no futuro → não entrega.
  - `enviar_grupo` preso há 3 min → `falhou` e não volta na lista.
  - `dispararAvisosDaHora`:
    - aviso com 3 grupos (um sem número no grupo) → 2 comandos com `executarApos` em `[agora, agora+8s]` (com `aleatorio=()=>0`) e 1 `sem_numero`;
    - número com 59 comandos hoje e aviso com 3 grupos → 1 comando, 2 `falhou` "Limite de envios do dia atingido.".
  - `conferirEventosMudados`:
    - aprovado com evento cuja `horaInicio` mudou → `rascunho` + alerta;
    - `enviando` com evento excluído → os comandos `pendente` viram `falhou` e os envios viram `falhou` "Cancelado: o evento mudou.".
  - `concluirComando` do último envio → aviso `concluido`.
- [ ] **Step 2–4:** FAIL → implementar → PASS + typecheck.
- [ ] **Step 5:** commit `feat(whatsapp): envio dos avisos pela fila do motor`.

### Task 5: Motor envia nos grupos

**Files:**
- Modify: `motor-whatsapp/src/tipos.ts`, `api.ts`, `conexoes.ts`, `principal.ts` (+ testes existentes em `api.test.ts`, `conexoes.test.ts`)

**Interfaces:**
- `ComandoMotor = { id; numeroId; tipo: "conectar" | "desconectar" } | { id; numeroId; tipo: "enviar_grupo"; dados: { jid: string; texto: string; envioId: string } }`.
- `buscarComandos()` chama `/api/whatsapp/motor/comandos?recursos=enviar_grupo`.
- `Conexoes.enviarTexto(numeroId, jid, texto): Promise<void>`:
  - lança `Error("Número não está conectado.")` se a vaga não está aberta;
  - valida que `jid` termina em `@g.us`, senão lança `Error("Destino não é um grupo.")`;
  - usa `sock.sendMessage(jid, { text: texto })`.
- `executar` em `principal.ts` usa um `switch` explícito sobre `tipo`; um tipo desconhecido responde `falhou` com "Comando desconhecido.". Logs nunca levam o texto nem o jid.

- [ ] **Step 1: Testes que falham:**
  - `buscarComandos` usa a URL com `?recursos=enviar_grupo`.
  - `enviarTexto` com a vaga fechada → rejeita com "Número não está conectado.".
  - `enviarTexto` para `"123@s.whatsapp.net"` → rejeita com "Destino não é um grupo.".
  - Com um sock falso aberto → `sendMessage` é chamado com `(jid, {text})`.
- [ ] **Step 2–4:** FAIL → implementar → `cd motor-whatsapp && npx vitest run && npx tsc --noEmit` → PASS.
- [ ] **Step 5:** commit `feat(motor-whatsapp): envia texto nos grupos`.

### Task 6: Telas

**Files:**
- Create: `src/app/(app)/whatsapp/avisos/page.tsx`
- Create: `src/modulos/whatsapp/componentes/avisos.tsx` (lista, partes "use client" só onde houver formulário)
- Create: `src/modulos/whatsapp/componentes/form-aviso.tsx` ("use client")
- Modify: `src/modulos/whatsapp/componentes/abas-whatsapp.tsx` (+ teste): na seção Grupos, a aba `avisos` (`/whatsapp/avisos`, rótulo "Avisos", permissão `whatsapp:avisos`) vem depois de Grupos.
- Modify: `src/app/(app)/whatsapp/configuracoes/page.tsx`: novo cartão "Avisos da agenda", visível com `whatsapp:avisos`.
- Create: `src/modulos/whatsapp/servicos/avisos-config.ts` (+ teste) e ação correspondente:
  - `listarTiposParaAvisos(ator)`: tipos ativos com `divulgarNosGrupos` e os grupos padrão;
  - `salvarTipoParaAvisos(ator, { tipoId, divulgar, grupos: string[] })`, com auditoria `whatsapp.avisos.config`.
- Modify: `src/modulos/whatsapp/servicos/visao-geral.ts` + `componentes/visao-geral.tsx` (+ teste):
  - cartão "Próximos envios": até 5 avisos `aprovado`/`enviando` dos próximos 7 dias, com data e hora, título e "→ N grupos";
  - em Pontos de atenção, "N avisos esperando aprovação" (rascunhos) com link para `/whatsapp/avisos`;
  - os dois só aparecem para quem tem `whatsapp:avisos`, e uma falha aparece como texto de falha (mesmo padrão da entrega 6).

Comportamento da página `/whatsapp/avisos` (exige `whatsapp:avisos`):
- Navegação por semana, como no Atendimento (`?semana=`).
- Botão "Novo aviso".
- Botão "Aprovar todos os rascunhos da semana" (mostra os recusados com o motivo).
- Cartão por aviso:
  - título do evento, ou "Aviso avulso";
  - selo da situação;
  - alerta em destaque, se houver;
  - texto (editável no formulário), data e hora (`datetime-local`), grupos (checkboxes com busca simples no cliente);
  - botões Salvar / Aprovar / Cancelar, conforme a situação;
  - depois do envio, a lista de grupos com ✓ enviado / ✗ falhou (motivo) / "sem número para enviar";
  - "Escrito pela IA" quando `textoPorIa`.
- Teste de abas: o gestor ganha `avisos` logo depois de `grupos`; o comercial não.

- [ ] **Step 1:** testes de abas e de `avisos-config` e `visao-geral` que falham.
- [ ] **Step 2–4:** FAIL → implementar → PASS + typecheck.
- [ ] **Step 5:** commit `feat(whatsapp): tela de avisos nos grupos`.

### Task 7: Documentação e runbook

**Files:**
- Modify: `docs/modulos/whatsapp.md`: seção "Avisos nos grupos" (fluxo, limites, quem aprova).
- Modify: `docs/runbooks/whatsapp-motor-vps.md`:
  - nova linha de cron no §18: `*/5 * * * * curl -fsS --max-time 300 -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/envios-whatsapp`;
  - nota em "Atualizar o motor": atualizar o motor **antes** de aprovar o primeiro aviso.
- Modify: `docs/lgpd/whatsapp-textos.md`: frase sobre o envio de avisos da escola nos grupos.

- [ ] **Step 1:** escrever. **Step 2:** commit `docs(whatsapp): avisos nos grupos`.

## Depois do envio (controlador)

1. Push para `teste`; conferir o deploy e a migration com `hosting_get-deployment`.
2. Atualizar o motor na VPS: `ssh -i ~/.ssh/ipemaster_motor_vps root@187.53.125.120`, depois `cd /opt/ipemaster-os && git pull && cd motor-whatsapp && npm ci && systemctl restart motor-whatsapp`. Conferir `systemctl is-active` e se o número volta conectado em /admin/saude.
3. O Gustavo cria o cron `envios-whatsapp` no hPanel.
4. O Gustavo marca, em Ajustes, os tipos de evento a divulgar e os grupos padrão, e faz um aviso avulso de teste para um grupo de teste.
