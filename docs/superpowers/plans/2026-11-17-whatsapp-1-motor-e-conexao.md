# WhatsApp — Entrega 1: motor e conexão. Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin cria a "vaga" de um número no IPEMaster OS, clica em Conectar, vê o QR, lê com o celular, e a tela mostra "Conectado"; o motor roda no Mac do Gustavo apontando para `teste`.

**Architecture:** Módulo novo `src/modulos/whatsapp/` (regras puras, esquemas, serviços `server-only`, ações, componentes) + rotas `/api/whatsapp/motor/*` protegidas por segredo. Motor separado em `motor-whatsapp/` (Node + Baileys) que conversa com o sistema só por HTTPS: manda eventos (QR, conexão, sinal) e busca comandos (conectar, desconectar) a cada 3 s. Nesta entrega não há mensagens, grupos nem IA.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (MySQL), Zod 4, Vitest, Tailwind v4/shadcn; motor: Node 22, TypeScript, `baileys` (versão estável fixa), `pino`, `tsx`; QR na tela: `qrcode` (SVG gerado no servidor).

**Spec:** `docs/superpowers/specs/2026-11-17-whatsapp-design.md` (seções 5, 6 — só `NumeroWhatsapp` e `ComandoWhatsapp` —, 7 regras 1–3, 9, 11 aba Números, 12 entrega 1).

## Global Constraints
- Tudo em português (código de domínio, interface, docs, commits). Conventional Commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Várias sessões trabalham nesta pasta.** Commite só os seus arquivos (`git commit -m "..." -- <arquivos>`). Nunca `git add -A`, stash, reset ou troca de branch. Branch `teste`. Push só com o OK do Gustavo, e antes rode `git log origin/teste..HEAD`.
- Antes de mexer em `prisma/schema.prisma`, `git status --short prisma/` tem que estar vazio. Não há banco local: a migration é gerada com `prisma migrate diff` (ver Task 2), numa pasta com timestamp posterior à última (hoje `20261117020000_comercial_metas_quantidade`).
- `MOTOR_WHATSAPP_SEGREDO` só no servidor e no `.env` do motor. Nunca na tela, no log, no banco, em mensagem de erro ou URL. O QR também nunca vai para log nem URL.
- Rotas do motor exigem `Authorization: Bearer $MOTOR_WHATSAPP_SEGREDO`, conferido com `segredoValido` de `@/lib/cron`. Sem segredo configurado, recusa tudo.
- Motor: `markOnlineOnConnect: false`, sem confirmação de leitura, reconexão com espera crescente (2 s, 4 s, 8 s… até 5 min).
- Datas em UTC no banco; exibição com `formatarDataHora` de `@/lib/datas`.
- A pasta `motor-whatsapp/` é um projeto à parte: fica fora do `tsconfig.json`, do ESLint e do Vitest da raiz, e o build da Hostinger não a usa.

## Review Focus
1. **QR velho:** o QR muda a cada ~20 s e a Baileys desiste depois de algumas tentativas. Se `qrEm` tem mais de 90 s e a vaga segue `aguardando_qr`, a tela diz "O QR expirou. Clique em Conectar de novo." e não mostra o QR antigo (teste em Task 3).
2. **Clique duplo em Conectar:** nunca cria dois comandos `conectar` pendentes para a mesma vaga (teste em Task 5).
3. **Motor desligado:** o comando fica pendente e a tela mostra "Motor sem resposta" quando `ultimoSinalEm` é nulo ou tem mais de 5 min (teste em Task 3). Comando preso `em_andamento` há mais de 2 min volta para a fila; na 3ª tentativa vira `falhou` (teste em Task 5).
4. **Desconectado pelo celular:** quando o celular remove o aparelho, o motor apaga a sessão e manda `desconectado` com motivo `removido_no_celular`; a tela pede para ler o QR de novo (testes em Tasks 5 e 8).
5. **Evento ruim no lote:** um evento de vaga inexistente ou excluída é ignorado sem derrubar o lote (resposta 200 com `ignorados`); corpo inválido dá 400 (testes em Tasks 5 e 6).

---

### Task 1: Permissões e ações de auditoria

**Files:**
- Modify: `src/lib/permissoes.ts`, `src/lib/permissoes.test.ts`, `src/lib/auditoria.ts`, `docs/04-seguranca-permissoes.md` (nova tabela "WhatsApp" na matriz)

**Interfaces:**
- Produces: permissões `"whatsapp:gerenciar_numeros"` (admin, gestor) e `"whatsapp:conectar_proprio"` (comercial); ações de auditoria `"whatsapp.numero_criado"`, `"whatsapp.numero_excluido"`, `"whatsapp.conexao_solicitada"`, `"whatsapp.desconexao_solicitada"`.

- [ ] **Step 1: Write the failing test** em `permissoes.test.ts`, `describe("permissões do WhatsApp")`: admin e gestor têm `whatsapp:gerenciar_numeros`; comercial não tem, mas tem `whatsapp:conectar_proprio`; colaborador, professor e aluno não têm nenhuma das duas; admin e gestor não têm `whatsapp:conectar_proprio` (não precisam).
- [ ] **Step 2: Run** `npx vitest run src/lib/permissoes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as duas permissões no tipo `Permissao` e no mapa; as quatro ações em `AcaoAuditoria`; a tabela na matriz do doc 04.
- [ ] **Step 4: Run** `npx vitest run src/lib/permissoes.test.ts` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): permissões e auditoria do módulo WhatsApp` com os quatro arquivos.

### Task 2: Modelos `NumeroWhatsapp` e `ComandoWhatsapp`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261117030000_whatsapp_numeros/migration.sql`

**Interfaces:**
- Produces (Prisma):
  - `enum FinalidadeNumeroWhatsapp { escola vendedor }`
  - `enum SituacaoNumeroWhatsapp { desconectado aguardando_qr conectado erro }`
  - `enum TipoComandoWhatsapp { conectar desconectar }` (os outros tipos do spec entram nas próximas entregas)
  - `enum SituacaoComandoWhatsapp { pendente em_andamento concluido falhou }`
  - `model NumeroWhatsapp` → `@@map("numeros_whatsapp")`: `id`, `nome VarChar(60)`, `finalidade`, `usuarioId String?` (relação com `Usuario`, dono quando vendedor), `telefone VarChar(20)?`, `situacao @default(desconectado)`, `qrAtual Text?`, `qrEm DateTime?`, `conectadoEm DateTime?`, `ultimoSinalEm DateTime?`, `erro VarChar(255)?`, `excluidoEm DateTime?`, `criadoEm`, `atualizadoEm`; `@@index([usuarioId])`.
  - `model ComandoWhatsapp` → `@@map("comandos_whatsapp")`: `id`, `numeroId` (relação), `tipo`, `dados Json?`, `situacao @default(pendente)`, `tentativas Int @default(0)`, `iniciadoEm DateTime?`, `concluidoEm DateTime?`, `erro VarChar(255)?`, `criadoEm`, `atualizadoEm`; `@@index([situacao, criadoEm])`, `@@index([numeroId, situacao])`.
  - Colunas `snake_case` via `@map`, como no resto do schema.

- [ ] **Step 1:** Confira `git status --short prisma/` (vazio).
- [ ] **Step 2:** Edite o schema. Gere o SQL: `git show HEAD:prisma/schema.prisma > <scratchpad>/anterior.prisma` e `npx prisma migrate diff --from-schema <scratchpad>/anterior.prisma --to-schema prisma/schema.prisma --script > prisma/migrations/20261117030000_whatsapp_numeros/migration.sql`. Confira que o SQL só cria as duas tabelas, as chaves e os índices.
- [ ] **Step 3: Run** `npx prisma validate`, `npx prisma generate`, `npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit** `feat(whatsapp): modelos de número e fila de comandos` com o schema e a migration.

### Task 3: Regras puras da conexão

**Files:**
- Create: `src/modulos/whatsapp/regras/conexao.ts`, `src/modulos/whatsapp/regras/conexao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const QR_VALIDO_MS = 90_000;
  export const MOTOR_SEM_SINAL_MS = 5 * 60_000;
  export type EstadoTela = "conectado" | "aguardando_qr" | "qr_expirado" | "desconectado" | "removido_no_celular" | "erro" | "motor_sem_resposta";
  export const ROTULO_ESTADO: Record<EstadoTela, string>;
  export function estadoNaTela(n: { situacao: SituacaoNumeroWhatsapp; qrEm: Date | null; ultimoSinalEm: Date | null; erro: string | null }, agora: Date): EstadoTela;
  export function telefoneDoJid(jid: string): string | null; // "5562999999999:12@s.whatsapp.net" → "5562999999999"
  ```
  Ordem de `estadoNaTela`: (1) `desconectado` → `removido_no_celular` se `erro === "removido_no_celular"`, senão `desconectado` (o sinal não importa); (2) motor sem sinal (nulo ou > 5 min) → `motor_sem_resposta`; (3) `aguardando_qr` com `qrEm` preenchido há mais de 90 s → `qr_expirado` (com `qrEm` nulo continua `aguardando_qr`); (4) senão, a própria situação (`conectado`, `aguardando_qr`, `erro`).
  Rótulos exatos: conectado "Conectado"; aguardando_qr "Aguardando leitura do QR"; qr_expirado "O QR expirou. Clique em Conectar de novo."; desconectado "Desconectado"; removido_no_celular "Removido no celular. Leia o QR de novo."; erro "Erro na conexão"; motor_sem_resposta "Motor sem resposta".

- [ ] **Step 1: Write the failing tests:** `conectado` com sinal de 1 min → `"conectado"`; `conectado` com sinal de 6 min → `"motor_sem_resposta"`; `conectado` com sinal nulo → `"motor_sem_resposta"`; `aguardando_qr` com `qrEm` de 30 s e sinal recente → `"aguardando_qr"`; com `qrEm` de 61 s → `"qr_expirado"`; `desconectado` com `erro: "removido_no_celular"` → `"removido_no_celular"`; `desconectado` sem sinal → `"desconectado"`; `telefoneDoJid("5562999999999:12@s.whatsapp.net")` → `"5562999999999"`, `telefoneDoJid("5562999999999@s.whatsapp.net")` → `"5562999999999"`, `telefoneDoJid("abc@lid")` → `null`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/regras`. Expected: FAIL.
- [ ] **Step 3: Implement** as funções e constantes acima.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): regras da situação da conexão`.

### Task 4: Esquemas Zod (tela e motor)

**Files:**
- Create: `src/modulos/whatsapp/esquemas/numero.ts`, `src/modulos/whatsapp/esquemas/motor.ts`, `src/modulos/whatsapp/esquemas/esquemas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // numero.ts
  export const esquemaNovoNumero: z.ZodType<{ nome: string; finalidade: "escola" | "vendedor"; usuarioId: string | null }>;
  // nome: trim, 1–60; usuarioId obrigatório quando finalidade = "vendedor" (mensagem "Escolha o vendedor dono do número."), e forçado a null quando "escola".
  // motor.ts
  export const esquemaEventoMotor; // discriminado por "tipo"
  //   { tipo: "qr", numeroId: string, qr: string (1–1000) }
  //   { tipo: "conectado", numeroId: string, telefone: string (só dígitos, 10–15) }
  //   { tipo: "desconectado", numeroId: string, motivo: "removido_no_celular" | "pedido" | "erro", detalhe?: string (≤255) }
  //   { tipo: "sinal", conectados: string[] }
  export const esquemaLoteEventos = z.object({ eventos: z.array(esquemaEventoMotor).max(500) });
  export const esquemaResultadoComando = z.object({ situacao: z.enum(["concluido", "falhou"]), erro: z.string().max(255).optional() });
  export type EventoMotor = z.infer<typeof esquemaEventoMotor>;
  ```
- [ ] **Step 1: Write the failing tests:** novo número `escola` sem usuário passa e sai com `usuarioId: null`; `vendedor` sem usuário falha com a mensagem acima; nome vazio e nome com 61 caracteres falham; evento `qr` válido passa; evento `conectado` com telefone `"62 9999"` falha; evento de `tipo` desconhecido falha; lote com 501 eventos falha.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/esquemas`. Expected: FAIL.
- [ ] **Step 3: Implement** os esquemas.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): esquemas da tela e do motor`.

### Task 5: Serviços (números e motor)

**Files:**
- Create: `src/modulos/whatsapp/servicos/numeros.ts`, `src/modulos/whatsapp/servicos/numeros.test.ts`, `src/modulos/whatsapp/servicos/motor.ts`, `src/modulos/whatsapp/servicos/motor.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `registrarAuditoria` (`@/lib/auditoria`), `ErroNegocio` (`@/lib/erros`), `ErroPermissao`/`temPermissao` (`@/lib/permissoes`), `UsuarioAtual` (`@/lib/sessao`).
- Produces:
  ```ts
  // numeros.ts ("server-only")
  export type NumeroNaTela = { id: string; nome: string; finalidade: FinalidadeNumeroWhatsapp; dono: string | null; telefone: string | null; estado: EstadoTela; rotulo: string; conectadoEm: Date | null; ultimoSinalEm: Date | null };
  export async function listarNumeros(ator: UsuarioAtual): Promise<NumeroNaTela[]>; // gestão vê todos; comercial só os seus
  export async function criarNumero(ator: UsuarioAtual, dados: unknown): Promise<{ id: string }>; // exige gerenciar_numeros
  export async function excluirNumero(ator: UsuarioAtual, numeroId: string): Promise<void>; // só desconectado; senão ErroNegocio("Desconecte o número antes de excluir.")
  export async function solicitarConexao(ator: UsuarioAtual, numeroId: string): Promise<void>;
  export async function solicitarDesconexao(ator: UsuarioAtual, numeroId: string): Promise<void>;
  export async function situacaoParaTela(ator: UsuarioAtual, numeroId: string): Promise<{ estado: EstadoTela; rotulo: string; qr: string | null }>; // qr só quando estado = "aguardando_qr"
  // motor.ts ("server-only")
  export async function aplicarEventos(eventos: EventoMotor[], agora?: Date): Promise<{ aplicados: number; ignorados: number }>;
  export async function entregarComandos(agora?: Date): Promise<{ id: string; numeroId: string; tipo: TipoComandoWhatsapp }[]>;
  export async function concluirComando(id: string, resultado: { situacao: "concluido" | "falhou"; erro?: string }): Promise<boolean>; // false se o comando não existe
  ```
  Regras:
  - Quem pode mexer numa vaga: `whatsapp:gerenciar_numeros`, ou `whatsapp:conectar_proprio` **e** `numero.usuarioId === ator.id`. Senão `ErroPermissao`. Vaga com `excluidoEm` → `ErroNegocio("Número não encontrado.")`.
  - `solicitarConexao`: se já há comando `conectar` `pendente` ou `em_andamento` para a vaga, não cria outro. Põe a vaga em `aguardando_qr`, limpa `qrAtual`, `qrEm` e `erro`. Audita `whatsapp.conexao_solicitada`.
  - `solicitarDesconexao`: cria comando `desconectar` (mesma regra de duplicidade). Audita.
  - `criarNumero` audita `whatsapp.numero_criado` (diff só com nome e finalidade). `excluirNumero` preenche `excluidoEm` e audita.
  - `aplicarEventos` (sem usuário): `qr` → `qrAtual`, `qrEm = agora`, `situacao = aguardando_qr`; `conectado` → `situacao = conectado`, `telefone`, `conectadoEm = agora`, limpa `qrAtual`/`qrEm`/`erro`; `desconectado` → `situacao = desconectado`, limpa QR, `erro = motivo` quando `removido_no_celular` ou `erro` (com `detalhe` truncado em 255), `null` quando `pedido`; `sinal` → `ultimoSinalEm = agora` em todas as vagas não excluídas. Evento de vaga inexistente ou excluída conta em `ignorados`.
  - `entregarComandos`: devolve, por ordem de `criadoEm`, os `pendente` e os `em_andamento` com `iniciadoEm` há mais de 2 min; marca `em_andamento`, `iniciadoEm = agora`, `tentativas + 1`. Um comando que chegaria à 4ª tentativa vira `falhou` com `erro = "O motor não concluiu o comando."` e não é entregue. Comandos de vaga excluída viram `falhou` sem ser entregues. No máximo 20 por chamada.
  - `concluirComando`: grava situação, `concluidoEm`, `erro`. Se falhou um `conectar`, a vaga vai para `erro` com o mesmo texto.

- [ ] **Step 1: Write the failing tests** com o padrão de banco em memória de `src/modulos/conteudo/servicos/integracao-instagram.test.ts` (`vi.mock("server-only")`, `vi.mock("@/lib/prisma")`, `vi.mock("@/lib/auditoria")`):
  - `numeros.test.ts`: comercial dono conecta a própria vaga; comercial não dono → `ErroPermissao`; dois `solicitarConexao` seguidos deixam **um** comando pendente; excluir vaga conectada → `ErroNegocio` com a mensagem exata; `listarNumeros` do comercial só traz as vagas dele; `situacaoParaTela` não devolve `qr` quando o estado é `qr_expirado`.
  - `motor.test.ts`: evento `qr` grava `qrAtual` e `qrEm`; `conectado` grava telefone e limpa o QR; `desconectado` com `removido_no_celular` grava o motivo em `erro`; evento de vaga excluída conta como ignorado e os outros do lote são aplicados; `sinal` atualiza `ultimoSinalEm`; `entregarComandos` não reentrega um `em_andamento` de 1 min, reentrega um de 3 min, e marca `falhou` o que já tem 3 tentativas; `concluirComando` de `conectar` com falha põe a vaga em `erro`; id desconhecido → `false`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/servicos`. Expected: FAIL.
- [ ] **Step 3: Implement** os dois serviços. Escritas de uma ação + auditoria na mesma `prisma.$transaction`.
- [ ] **Step 4: Run** o mesmo comando e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): serviços de números e do motor`.

### Task 6: Rotas do motor

**Files:**
- Create: `src/app/api/whatsapp/motor/eventos/route.ts`, `src/app/api/whatsapp/motor/comandos/route.ts`, `src/app/api/whatsapp/motor/comandos/[id]/route.ts`, `src/modulos/whatsapp/servicos/rotas-motor.test.ts`
- Modify: `docs/02-arquitetura.md` (variável `MOTOR_WHATSAPP_SEGREDO` na lista e as três rotas em "Route Handlers")

**Interfaces:**
- Consumes: `aplicarEventos`, `entregarComandos`, `concluirComando` (Task 5); `esquemaLoteEventos`, `esquemaResultadoComando` (Task 4); `segredoValido` (`@/lib/cron`).
- Produces (contrato HTTP usado pelo motor na Task 8):
  - `POST /api/whatsapp/motor/eventos` corpo `{ eventos: EventoMotor[] }` → 200 `{ ok: true, aplicados, ignorados }`; 400 `{ ok: false }` se o corpo não valida; 401 sem segredo.
  - `GET /api/whatsapp/motor/comandos` → 200 `{ comandos: { id, numeroId, tipo }[] }`.
  - `POST /api/whatsapp/motor/comandos/:id` corpo `{ situacao, erro? }` → 200 `{ ok: true }`; 404 se não existe; 400; 401.
  - Todas com `export const dynamic = "force-dynamic"`. Nunca devolvem o motivo do erro de validação (só `{ ok: false }`).

- [ ] **Step 1: Write the failing tests** importando os `POST`/`GET` das rotas com os serviços mockados: sem header → 401; header errado → 401; `MOTOR_WHATSAPP_SEGREDO` vazio → 401 mesmo com header `Bearer `; lote inválido → 400; lote válido → 200 com os números do serviço; `comandos/:id` desconhecido → 404.
- [ ] **Step 2: Run** `npx vitest run src/modulos/whatsapp/servicos/rotas-motor.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as três rotas e o trecho do doc 02.
- [ ] **Step 4: Run** o mesmo comando e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(whatsapp): rotas do motor protegidas por segredo`.

### Task 7: Tela Números (menu WhatsApp)

**Files:**
- Create: `src/modulos/whatsapp/acoes/numeros.ts`, `src/modulos/whatsapp/componentes/lista-numeros.tsx`, `src/modulos/whatsapp/componentes/novo-numero.tsx`, `src/modulos/whatsapp/componentes/conectar-numero.tsx`, `src/app/(app)/whatsapp/page.tsx` (redireciona para `/whatsapp/numeros`), `src/app/(app)/whatsapp/numeros/page.tsx`, `docs/modulos/whatsapp.md`
- Modify: `src/app/(app)/layout.tsx` (item "WhatsApp" para quem tem `whatsapp:gerenciar_numeros` ou `whatsapp:conectar_proprio`), `src/app/(app)/menu-navegacao.tsx` (ícone `whatsapp: <MessageCircleIcon />`), `package.json` (`qrcode` e `@types/qrcode`, versões exatas)

**Interfaces:**
- Consumes: serviços da Task 5; `exigirPermissaoPagina`, `exigirUsuario` (`@/lib/sessao`); `tratarErroAcao`, `EstadoAcao` (`@/lib/acoes`).
- Produces (Server Actions, todas com `"use server"`):
  ```ts
  criarNumeroAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>>
  excluirNumeroAcao(numeroId: string): Promise<EstadoAcao>
  conectarNumeroAcao(numeroId: string): Promise<EstadoAcao>
  desconectarNumeroAcao(numeroId: string): Promise<EstadoAcao>
  situacaoNumeroAcao(numeroId: string): Promise<EstadoAcao<{ estado: EstadoTela; rotulo: string; qrSvg: string | null }>> // SVG gerado com QRCode.toString(qr, { type: "svg", margin: 1 })
  ```
- Tela `/whatsapp/numeros`: tabela com nome, finalidade ("Escola"/"Vendedor"), dono, telefone, situação (rótulo de `ROTULO_ESTADO`), conectado em, último sinal. Botões por linha: Conectar (quando não conectado), Desconectar (quando conectado, com confirmação "Desconectar este número? Para voltar, será preciso ler o QR de novo."), Excluir (só desconectado). "Novo número" só para quem tem `whatsapp:gerenciar_numeros`: nome, finalidade, vendedor dono (lista de usuários ativos com papel `comercial`, aparece só quando finalidade = vendedor).
- Diálogo Conectar: chama `conectarNumeroAcao` e passa a chamar `situacaoNumeroAcao` a cada 2 s enquanto aberto. Mostra o QR com a instrução "No celular: WhatsApp › Aparelhos conectados › Conectar um aparelho". Ao chegar `conectado`, mostra "Conectado!" e fecha em 2 s. Em `qr_expirado`, `erro` ou `motor_sem_resposta`, para de consultar e mostra o rótulo com o botão "Tentar de novo".
- `docs/modulos/whatsapp.md`: entidades, permissões, a tela e as regras desta entrega, no formato dos outros docs de módulo.

- [ ] **Step 1:** Instale `qrcode` e `@types/qrcode` com versão exata.
- [ ] **Step 2: Implement** as ações, os componentes, as páginas, o menu e o doc do módulo.
- [ ] **Step 3: Run** `npm run lint`, `npm run typecheck`, `npm run test`. Expected: PASS.
- [ ] **Step 4: Verify** no navegador com `npm run dev`: como admin, criar a vaga "Teste", ver a linha "Desconectado"; clicar em Conectar e ver "Motor sem resposta" (motor ainda não existe); como comercial, ver só as próprias vagas e não ver "Novo número". Screenshot.
- [ ] **Step 5: Commit** `feat(whatsapp): tela de números com QR` (inclua `package.json` e `package-lock.json`).

### Task 8: Motor (`motor-whatsapp/`)

**Files:**
- Create: `motor-whatsapp/package.json`, `motor-whatsapp/tsconfig.json`, `motor-whatsapp/.env.exemplo`, `motor-whatsapp/.gitignore` (`node_modules`, `.env`, `sessoes/`), `motor-whatsapp/README.md`, `motor-whatsapp/src/tipos.ts`, `motor-whatsapp/src/config.ts`, `motor-whatsapp/src/api.ts`, `motor-whatsapp/src/fila-eventos.ts`, `motor-whatsapp/src/espera.ts`, `motor-whatsapp/src/conexoes.ts`, `motor-whatsapp/src/principal.ts`, `motor-whatsapp/src/fila-eventos.test.ts`, `motor-whatsapp/src/espera.test.ts`, `motor-whatsapp/src/conexoes.test.ts`, `docs/decisoes/0006-motor-whatsapp-por-qr.md`
- Modify: `tsconfig.json` (`"exclude": ["node_modules", "motor-whatsapp"]`), `eslint.config.mjs` (ignorar `motor-whatsapp/**`), `docs/decisoes/README.md` (índice)

**Interfaces:**
- Consumes: contrato HTTP da Task 6.
- Produces:
  ```ts
  // tipos.ts — cópia local do tipo EventoMotor da Task 4 (o motor não importa nada de src/)
  // config.ts — lê do ambiente; falta de SISTEMA_URL ou MOTOR_WHATSAPP_SEGREDO encerra com mensagem clara (sem imprimir o segredo)
  export const config: { sistemaUrl: string; segredo: string; pastaSessoes: string /* padrão "./sessoes" */ };
  // espera.ts
  export function esperaReconexao(tentativa: number): number; // ms: 2000 * 2^tentativa, teto 300_000
  // fila-eventos.ts
  export class FilaEventos { constructor(enviar: (eventos: EventoMotor[]) => Promise<void>, opcoes?: { intervaloMs?: number /* 3000 */; tamanhoMaximo?: number /* 100 */ }); adicionar(e: EventoMotor): void; esvaziar(): Promise<void>; parar(): void }
  // Falha ao enviar: os eventos voltam para o início da fila e a próxima tentativa segue o intervalo normal. Eventos "qr" da mesma vaga: só o mais novo fica na fila.
  // conexoes.ts
  export function motivoDoFechamento(statusCode: number | undefined): "removido_no_celular" | "reconectar"; // DisconnectReason.loggedOut → removido_no_celular
  export class Conexoes { conectar(numeroId: string): Promise<void>; desconectar(numeroId: string): Promise<void>; conectados(): string[]; retomarSalvas(): Promise<void> }
  ```
  Comportamento de `Conexoes`: uma sessão por pasta `pastaSessoes/<numeroId>` com `useMultiFileAuthState`; `makeWASocket({ auth, markOnlineOnConnect: false, syncFullHistory: false, logger: pino({ level: "warn" }) })`; `connection.update`: `qr` → evento `qr`; `open` → evento `conectado` com `telefoneDoJid(sock.user.id)` (copie a função da Task 3; o motor não importa código do `src/`); `close` → `motivoDoFechamento`: `removido_no_celular` apaga a pasta e manda `desconectado`; `reconectar` agenda nova conexão com `esperaReconexao`. Se `conectar` é chamado para uma vaga já aberta, não abre outra. `desconectar` faz `logout()`, apaga a pasta e manda `desconectado` com motivo `pedido`. `retomarSalvas` reconecta toda pasta existente ao iniciar. **Nunca** logar QR, telefone ou segredo.
  `principal.ts`: `retomarSalvas()`; a cada 3 s busca comandos e executa um por vez, respondendo `concluido`/`falhou`; a cada 60 s adiciona `{ tipo: "sinal", conectados }`; em `SIGINT`/`SIGTERM` esvazia a fila e sai.
  `package.json`: `"type": "module"`, scripts `start` (`tsx src/principal.ts`) e `test` (`vitest run`); `baileys` com versão exata — use a mais nova estável que já traga a correção do pareamento; se só houver a 7 rc com o bug, aplique o patch com `patch-package`, como no sistema do amigo.
- ADR 0006: contexto (só o QR lê grupos e conversas do aplicativo), decisão (Baileys num motor próprio em VPS, conversando por HTTPS, sessão no disco), consequências (risco de bloqueio e regras do spec seção 9; VPS a manter; MySQL fechado para fora), alternativas (Evolution API, API oficial).
- README do motor: como rodar no Mac apontando para `teste` (`cp .env.exemplo .env`, preencher `SISTEMA_URL=https://teste.plataformaipemaster.com.br` e o segredo, `npm install`, `npm start`), em português simples.

- [ ] **Step 1: Write the failing tests:** `esperaReconexao(0)` = 2000, `(3)` = 16000, `(20)` = 300000; `FilaEventos` envia em lote ao chegar a 100 eventos, envia o que houver a cada intervalo (use `vi.useFakeTimers()`), devolve os eventos à fila quando `enviar` falha e reenvia na próxima vez, e mantém só o `qr` mais novo de uma vaga; `motivoDoFechamento(DisconnectReason.loggedOut)` = `"removido_no_celular"`, `(DisconnectReason.connectionClosed)` = `"reconectar"`, `(undefined)` = `"reconectar"`.
- [ ] **Step 2: Run** `cd motor-whatsapp && npm install && npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** todos os arquivos acima, o ADR e os ajustes de `tsconfig.json`/ESLint da raiz.
- [ ] **Step 4: Run** `cd motor-whatsapp && npm test && npx tsc --noEmit`; na raiz, `npm run lint` e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Verify (ponta a ponta, local):** com `npm run dev` na raiz e o motor apontando para `http://localhost:3000` (mesmo segredo nos dois `.env`), criar a vaga, clicar em Conectar e ver o QR na tela em até 5 s. A leitura com o celular fica para o teste do Gustavo (Task 9).
- [ ] **Step 6: Commit** `feat(whatsapp): motor com Baileys e ADR 0006`.

### Task 9: Teste com o Gustavo em `teste`

Sem código novo. Depois do push (com o OK do Gustavo):

- [ ] **Step 1:** Guiar o Gustavo, um passo por vez, a colar `MOTOR_WHATSAPP_SEGREDO` no hPanel do site de teste (o valor ele gera no próprio Mac com `openssl rand -hex 32` e cola também no `.env` do motor; o valor nunca passa pelo chat).
- [ ] **Step 2:** Ele roda o motor no Mac (`README.md` do motor), cria uma vaga com um número de teste, clica em Conectar e lê o QR.
- [ ] **Step 3:** Conferir com ele: a tela mostra "Conectado" e o telefone; parar e iniciar o motor não pede QR de novo; "Desconectar" volta para "Desconectado" e o aparelho some da lista do celular; remover o aparelho pelo celular mostra "Removido no celular. Leia o QR de novo.".
- [ ] **Step 4:** Atualizar a memória do projeto com o estado da entrega.
