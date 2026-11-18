# WhatsApp — Entrega 2b (motor na VPS, saúde e LGPD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o motor pronto para rodar sempre ligado numa VPS. Mostrar a saúde da captura em `/admin/saude`. Fechar as pendências de LGPD e de captura que ficaram da entrega 2a.

**Architecture:**
- **Motor (`motor-whatsapp/`):** ganha trava de instância única, logger da Baileys silencioso e pasta de sessões resolvida a partir da pasta do motor. Ganha também os arquivos de implantação: unidade systemd e script de cópia diária das sessões.
- **Servidor:** ganha uma tela de saúde e regras novas na limpeza diária:
  - religar contatos a alunos e usuários cadastrados depois;
  - apagar conversas e contatos sem mensagens.
- **Captura:** a mensagem própria em conversa `@lid` passa a ir para a conversa do telefone.
- **Gestão:** ganha a ação "apagar dados de um telefone".

**Tech Stack:**
- Next.js 16 App Router, Prisma 7 + MySQL (adapter mariadb), Zod 4 e Vitest.
- Motor: Node 22, TypeScript, baileys 6.7.24, pino, tsx e vitest próprio.

**Spec:** `docs/superpowers/specs/2026-11-17-whatsapp-design.md`. Seções usadas:
- 5 (motor na VPS com reinício automático, sessão em disco com cópia diária);
- 7, regra 3 (saúde em `/admin/saude`);
- 10 (LGPD: textos, logs, direitos do titular);
- 12, entrega 2 (critério: "reiniciar a VPS não pede QR de novo").

Base: o plano da 2a, `docs/superpowers/plans/2026-11-17-whatsapp-2a-captura.md`.

## Global Constraints
- **Logs:** nunca registrar texto de mensagem, telefone, JID ou QR em log (spec 10). Erros vão para o log só com nome e códigos.
- **Consultas no Prisma:** nunca usar `contains`, `startsWith` nem `endsWith`. No MySQL da Hostinger o LIKE com parâmetro dá P2039/1267 ("Illegal mix of collations"). Compare por igualdade (`in`) ou filtre no código.
- **Testes de banco:** o mock em memória de `servicos/captura.test.ts` lança erro se receber `contains`, `startsWith` ou `endsWith`. Novos mocks de banco seguem a mesma regra.
- **Permissões:**
  - `whatsapp:gerenciar_numeros` (admin, gestor) para `/admin/saude` e para apagar dados de um telefone;
  - nenhuma permissão nova.
- **Auditoria nova:** `whatsapp.dados_telefone_apagados`. Leva só ids e contagens, nunca o telefone.
- **Retenção:**
  - `DIAS_RETENCAO = 90`;
  - conversa individual sem mensagens e sem atividade há mais de 90 dias é apagada, menos as de categoria `pessoal` (elas guardam a marca que descarta as próximas mensagens);
  - contato sem mensagens, sem conversas e sem ligação com aluno ou usuário é apagado.
- **Motor:**
  - a trava de instância fica em `<pastaSessoes>/.motor.pid`;
  - a variável `NIVEL_LOG_BAILEYS` vale `silent` por padrão;
  - pasta de sessões relativa é resolvida a partir da pasta `motor-whatsapp/`, não do diretório de onde o comando foi rodado.
- **Textos de tela** em português simples, como nas telas da 2a.
- **Commits:** só os arquivos da tarefa, `git commit -m ... -- <arquivos>`. Nunca `git add -A`.

## Review Focus
1. **Dois motores na mesma máquina:** o segundo `npm start` encerra com "Outro motor já está rodando (pid N)." e não abre conexão. Uma trava velha (processo morto) não impede de iniciar. → Tarefa 1.
2. **Motor iniciado de outra pasta** (`node motor-whatsapp/...` a partir da raiz ou pelo systemd): usa a mesma pasta de sessões e não pede QR de novo. → Tarefa 1.
3. **Contato de conversa pessoal sem mensagens:** a limpeza não apaga a conversa pessoal nem o contato dela. Senão as próximas mensagens voltam a ser guardadas. → Tarefa 3.
4. **Aluno cadastrado depois da primeira mensagem:** a limpeza liga o contato ao aluno. A conversa que ainda está na categoria inicial `lead` vira `aluno`. Categoria mudada à mão nunca é trocada. → Tarefa 3.
5. **Apagar dados de um telefone em outro formato** (com ou sem 55, com ou sem o 9): acha o mesmo contato e apaga também as mensagens que ele escreveu em grupos. → Tarefa 4.

---

### Task 1: Motor — trava de instância, logger silencioso e pasta de sessões absoluta

**Files:**
- Create: `motor-whatsapp/src/trava.ts`, `motor-whatsapp/src/trava.test.ts`
- Modify:
  - `motor-whatsapp/src/config.ts` (pasta de sessões e nível do log);
  - `motor-whatsapp/src/conexoes.ts:65` (logger);
  - `motor-whatsapp/src/principal.ts` (trava no início, liberar ao sair);
  - `motor-whatsapp/.env.exemplo`, `motor-whatsapp/README.md`.
- Test: `motor-whatsapp/src/trava.test.ts`, `motor-whatsapp/src/config.test.ts` (criar)

**Interfaces:**
- Produces:
  - `adquirirTrava(pasta: string, pid?: number): () => void`. Lança `Error("Outro motor já está rodando (pid N).")` quando há um processo vivo com aquele pid.
  - `resolverPastaSessoes(valor: string | undefined, baseMotor: string): string`.
  - `config.nivelLogBaileys: string`.

- [ ] **Step 1: Escreva os testes da trava** (`trava.test.ts`, com uma pasta temporária por teste):
  - `"cria .motor.pid com o pid e liberar apaga o arquivo"`;
  - `"com outro processo vivo na trava, lança 'Outro motor já está rodando (pid N).'"`: grave `process.ppid` no arquivo, que é um processo vivo diferente do atual;
  - `"trava velha de processo morto é substituída"`: grave um pid inexistente, como `999999`;
  - `"cria a pasta se ela não existe"`.
- [ ] **Step 2: Escreva os testes da pasta** (`config.test.ts`). Teste `resolverPastaSessoes` puro e importe de um módulo que não leia o ambiente. Coloque a função em `trava.ts` ou em um `caminhos.ts` novo, à escolha do implementador.
  - `resolverPastaSessoes(undefined, "/opt/motor")` → `"/opt/motor/sessoes"`;
  - `resolverPastaSessoes("./dados", "/opt/motor")` → `"/opt/motor/dados"`;
  - `resolverPastaSessoes("/var/sessoes", "/opt/motor")` → `"/var/sessoes"`.
- [ ] **Step 3:** Rode `cd motor-whatsapp && npx vitest run`. Esperado: os novos falham.
- [ ] **Step 4: Implemente:**
  - **Trava:** `writeFileSync(arquivo, pid, { flag: "wx" })`. Em `EEXIST`, leia o pid e confira com `process.kill(pid, 0)`; `ESRCH` quer dizer morto e, nesse caso, sobrescreva. `liberar` só apaga o arquivo se ele ainda tiver o próprio pid.
  - **Config:** `pastaSessoes = resolverPastaSessoes(process.env.PASTA_SESSOES, path.resolve(import.meta.dirname, ".."))` e `nivelLogBaileys = process.env.NIVEL_LOG_BAILEYS?.trim() || "silent"`.
  - **Conexões:** `pino({ level: config.nivelLogBaileys })`. O construtor de `Conexoes` recebe o nível nas opções, para os testes não dependerem do ambiente.
  - **Principal:** chame `adquirirTrava(config.pastaSessoes)` antes de `retomarSalvas()`. Se lançar, `console.error("[motor] <mensagem>")` e `process.exit(1)`. Chame `liberar()` em `encerrar` antes do `process.exit(0)`.
- [ ] **Step 5:** Rode `npx vitest run && npx tsc --noEmit` em `motor-whatsapp`. Esperado: PASS.
- [ ] **Step 6:** Documente `PASTA_SESSOES` e `NIVEL_LOG_BAILEYS` (valores `silent`, `warn`, `info`) no `.env.exemplo` e no README. Diga que `warn` só deve ser usado para investigar, porque a Baileys pode imprimir JIDs.
- [ ] **Step 7: Commit** `feat(motor-whatsapp): trava de instância, log da Baileys silencioso e pasta de sessões absoluta`.

### Task 2: Motor — arquivos de implantação na VPS e runbook

**Files:**
- Create:
  - `motor-whatsapp/deploy/motor-whatsapp.service` (unidade systemd);
  - `motor-whatsapp/deploy/copiar-sessoes.sh` (cópia diária);
  - `docs/runbooks/whatsapp-motor-vps.md`.
- Modify: `motor-whatsapp/README.md` (link para o runbook), `docs/modulos/whatsapp.md` (situação da implementação).

**Interfaces:** nenhuma de código.

- [ ] **Step 1: Escreva a unidade systemd** com:
  - usuário `motor` (sem login);
  - `WorkingDirectory=/opt/ipemaster-os/motor-whatsapp`;
  - `ExecStart=/usr/bin/npm start`;
  - `Restart=always`, `RestartSec=10`;
  - `EnvironmentFile=/opt/ipemaster-os/motor-whatsapp/.env`;
  - `KillSignal=SIGINT`, para o motor esvaziar a fila ao parar;
  - `TimeoutStopSec=90`;
  - `WantedBy=multi-user.target`.
- [ ] **Step 2: Escreva `copiar-sessoes.sh`:**
  - `tar -czf /var/backups/motor-whatsapp/sessoes-$(date +%F).tar.gz -C <pasta> sessoes`;
  - apaga as cópias com mais de 7 dias;
  - permissões 600 nos arquivos e 700 na pasta, porque as sessões são as chaves do aparelho;
  - `set -euo pipefail`.

  Rode `bash -n motor-whatsapp/deploy/copiar-sessoes.sh`. Esperado: sem saída.
- [ ] **Step 3: Escreva o runbook** em passos numerados, para o Gustavo seguir com o Claude guiando. Os passos:
  1. Contratar a VPS Hostinger (plano KVM mais simples, Ubuntu 24.04 LTS). Quem faz é o Gustavo.
  2. Entrar por SSH.
  3. Instalar Node 22 (NodeSource) e git.
  4. Rodar `git config --global url."https://github.com/".insteadOf ssh://git@github.com/`, porque a `libsignal` vem por `git+ssh` no `package-lock`.
  5. Clonar o repositório em `/opt/ipemaster-os` com uma deploy key só de leitura.
  6. Rodar `npm ci` em `motor-whatsapp`.
  7. Criar `.env` com `SISTEMA_URL` e `MOTOR_WHATSAPP_SEGREDO`, que o Gustavo cola, e `chmod 600`.
  8. Criar o usuário `motor` e passar a ele a pasta de sessões.
  9. Instalar e ativar a unidade (`systemctl enable --now motor-whatsapp`).
  10. Agendar a cópia diária das sessões às 3h30 no cron do root.
  11. Firewall: só SSH de entrada, porque o motor só faz chamadas de saída.
  12. **Antes de ligar na VPS, parar o motor do Mac.** Dois motores com a mesma sessão fazem o WhatsApp derrubar um deles (440).
  13. Ler o QR de novo, porque a sessão do Mac não é copiada para a VPS.
  14. **Teste de aceite:** `sudo reboot`. A vaga volta a "Conectado" sem QR em até 2 min.
  15. Atualizar o motor: `git pull`, `npm ci` e `systemctl restart motor-whatsapp`.
  16. Ver os logs: `journalctl -u motor-whatsapp -n 100`.
  17. Restaurar a cópia das sessões.
- [ ] **Step 4: Commit** `docs(whatsapp): implantação do motor na VPS (systemd, cópia das sessões, runbook)`.

### Task 3: Servidor — limpeza religa contatos e apaga conversas e contatos sem mensagens

**Files:**
- Modify:
  - `src/modulos/whatsapp/servicos/limpeza.ts`;
  - `src/modulos/whatsapp/servicos/captura.ts` (exportar o índice de telefones);
  - `src/app/api/cron/[tarefa]/route.ts` (contagens novas na resposta de `limpar-whatsapp`);
  - `docs/modulos/whatsapp.md` (regra 11).
- Test: `src/modulos/whatsapp/servicos/limpeza.test.ts`

**Interfaces:**
- Consumes: `chaveTelefone`, `categoriaInicial` de `regras/captura.ts`. O índice de telefones de `captura.ts` passa a ser exportado como `ligacoesDoTelefone(chave: string): Promise<{ alunoId: string | null; usuarioId: string | null }>`, que é a função `ligacoes` renomeada.
- Produces: `limparWhatsapp(agora?: Date): Promise<{ provisorias: number; antigas: number; religados: number; conversasVazias: number; contatosVazios: number }>`.

- [ ] **Step 1: Escreva os testes** (o mock lança em `contains`, `startsWith` e `endsWith`):
  - `"contato com telefone e sem ligação ganha o aluno cadastrado depois e a conversa 'lead' vira 'aluno'"`;
  - `"conversa com categoria mudada à mão (ex.: 'outro' escolhido pela gestão) não muda ao religar"`. Use a regra: só muda quem está em `lead`, a categoria que `categoriaInicial` dá a contato sem ligação;
  - `"individual sem mensagens e sem atividade há mais de 90 dias é apagada"`;
  - `"individual 'pessoal' sem mensagens continua"`;
  - `"grupo sem mensagens continua"`;
  - `"contato sem mensagens, sem conversas e sem ligação é apagado; com aluno ligado continua"`;
  - `"a resposta traz religados, conversasVazias e contatosVazios"`.
- [ ] **Step 2:** Rode `npx vitest run src/modulos/whatsapp/servicos/limpeza.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implemente nesta ordem**, depois das duas limpezas de mensagens que já existem:
  1. **Religar:** percorra os contatos com `telefone` não nulo e `alunoId`/`usuarioId` nulos, em lotes de 500. Para cada um, chame `ligacoesDoTelefone(chaveTelefone(telefone))`. Se ganhou ligação, atualize o contato e use `updateMany` nas conversas individuais dele com `categoria: "lead"` para a nova `categoriaInicial`.
  2. **Conversas vazias:** apague as conversas com `tipo: "individual"`, `categoria` diferente de `pessoal`, `mensagens: { none: {} }` e `OR` entre `ultimaMensagemEm < limite`, ou `ultimaMensagemEm` nulo com `criadoEm < limite`, onde o limite é de 90 dias.
  3. **Contatos vazios:** apague os contatos com `mensagens: { none: {} }`, `conversas: { none: {} }`, `alunoId: null` e `usuarioId: null`.

  Use contagens no retorno, nunca nomes ou telefones.
- [ ] **Step 4:** Rode os testes do módulo e `npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Atualize a regra 11 de `docs/modulos/whatsapp.md` com as três etapas novas.
- [ ] **Step 6: Commit** `feat(whatsapp): limpeza religa contatos e apaga conversas e contatos sem mensagens`.

### Task 4: Servidor — mensagem própria em conversa @lid e "apagar dados de um telefone"

**Files:**
- Modify:
  - `src/modulos/whatsapp/servicos/captura.ts` (conversa individual pelo `@lid`);
  - `src/lib/auditoria.ts` (ação nova);
  - `docs/modulos/whatsapp.md`;
  - `docs/04-seguranca-permissoes.md` (direitos do titular: como apagar os dados de WhatsApp).
- Create:
  - `src/modulos/whatsapp/servicos/titular.ts`, `src/modulos/whatsapp/servicos/titular.test.ts`;
  - `src/modulos/whatsapp/esquemas/titular.ts`;
  - a ação `apagarDadosTelefoneAcao` em `src/modulos/whatsapp/acoes/numeros.ts`;
  - `src/modulos/whatsapp/componentes/apagar-dados-telefone.tsx` (botão e diálogo na tela Números, só para quem tem `whatsapp:gerenciar_numeros`).
- Test: `captura.test.ts`, `titular.test.ts`

**Interfaces:**
- Consumes: `variantesTelefone`, `chaveTelefone` de `regras/captura.ts`; `registrarAuditoria` de `src/lib/auditoria.ts` (use a assinatura que já existe).
- Produces: `apagarDadosDoTelefone(telefone: string, atorId: string): Promise<{ encontrado: boolean; mensagens: number; conversas: number }>`.

- [ ] **Step 1: Escreva os testes da captura:**
  - `"mensagem própria em conversa @lid de contato com telefone vai para a conversa do telefone"`. Monte assim: o contato tem `lid: "123@lid"` e `telefone: "5562981707432"`, e chega uma mensagem com `deMim: true` e `jid: "123@lid"`. A mensagem deve ir para a conversa `5562981707432@s.whatsapp.net`;
  - `"@lid de contato sem telefone continua na conversa @lid"`.
- [ ] **Step 2: Escreva os testes do titular:**
  - `"acha o contato pelo telefone em outro formato e apaga as mensagens dele (também em grupos), as conversas individuais e o contato"`;
  - `"telefone sem contato devolve encontrado: false e não audita"`;
  - `"audita whatsapp.dados_telefone_apagados só com ids e contagens"`: confira que o telefone não aparece em `JSON.stringify` da chamada de auditoria;
  - `"telefone inválido (menos de 10 dígitos) é recusado pelo esquema"`.
- [ ] **Step 3:** Rode os testes. Esperado: FAIL.
- [ ] **Step 4: Implemente:**
  - **Captura:** em `aplicarMensagens`, antes de procurar a conversa individual cujo jid termina em `@lid`, busque `contatoWhatsapp.findUnique({ where: { lid: jid } })`. Se o contato tiver `telefone`, use `${telefone}@s.whatsapp.net`. Guarde o resultado no `ContextoCaptura`, num mapa novo `jidDoLid`.
  - **Titular:** numa transação, apague nesta ordem:
    1. as mensagens com `contatoId`;
    2. as conversas individuais com `contatoId`, que levam as mensagens em cascata;
    3. o contato.

    Depois chame `registrarAuditoria` com a ação `whatsapp.dados_telefone_apagados`, o id do contato e as contagens.
  - **Ação:** a ação confere `whatsapp:gerenciar_numeros` e valida com Zod (só dígitos depois de tirar a máscara, de 10 a 13).
  - **Diálogo:** campo "Telefone", com o aviso "Apaga o contato, as conversas e todas as mensagens deste telefone. Não dá para desfazer.". A confirmação pede para digitar o telefone de novo. O resultado aparece como "Dados apagados: N mensagens e M conversas." ou "Nenhum contato com este telefone.".
- [ ] **Step 5:** Rode os testes do módulo e `npm run typecheck`. Esperado: PASS.
- [ ] **Step 6: Documente:**
  - em `docs/modulos/whatsapp.md`, as regras novas (@lid e titular);
  - em `docs/04-seguranca-permissoes.md`, que o pedido de exclusão de um titular é atendido no WhatsApp por essa ação. `SolicitacaoTitular` ainda não tem tela, e a ligação com ela fica para quando a tela existir.
- [ ] **Step 7: Commit** `feat(whatsapp): mensagem própria em @lid vai para a conversa do telefone; apagar dados de um telefone`.

### Task 5: Servidor — tela `/admin/saude` e textos de LGPD

**Files:**
- Create:
  - `src/modulos/whatsapp/servicos/saude.ts`, `src/modulos/whatsapp/servicos/saude.test.ts`;
  - `src/app/(app)/admin/saude/page.tsx`;
  - `docs/lgpd/whatsapp-textos.md`.
- Modify:
  - `src/app/(app)/layout.tsx` (item "Saúde" ao lado de "Auditoria", para quem tem `whatsapp:gerenciar_numeros`);
  - `docs/modulos/whatsapp.md` (tela de saúde);
  - `docs/04-seguranca-permissoes.md` (link para os textos).

**Interfaces:**
- Consumes: `estadoNaTela`, `ROTULO_ESTADO`, `MOTOR_SEM_SINAL_MS` de `regras/conexao.ts`.
- Produces: `saudeWhatsapp(agora?: Date): Promise<{ motorVivo: boolean; ultimoSinalEm: Date | null; numeros: { id: string; nome: string; estado: string; ultimoSinalEm: Date | null; mensagens24h: number; ultimaMensagemEm: Date | null }[] }>`.

- [ ] **Step 1: Escreva os testes:**
  - `"motor vivo quando algum número teve sinal há menos de 5 min"`;
  - `"sem sinal há mais de 5 min: motorVivo false"`;
  - `"conta as mensagens das últimas 24 h por número, pelo numeroId que capturou"`;
  - `"número excluído não aparece"`.
- [ ] **Step 2:** Rode os testes. Esperado: FAIL.
- [ ] **Step 3: Implemente:**
  - **Serviço:** `estado` vem de `estadoNaTela` e o rótulo de `ROTULO_ESTADO`. As mensagens saem de um `groupBy` em `mensagemWhatsapp` por `numeroId` com `enviadaEm >= agora - 24h`, com `_count` e `_max`.
  - **Página** (só servidor; sem permissão, use o `notFound` ou o redirecionamento que as outras páginas de admin usam). Mostra:
    - um cartão "Motor do WhatsApp": "Ligado", ou "Sem resposta desde <data>";
    - uma tabela com número, situação, último sinal, mensagens nas últimas 24 h e última mensagem.
- [ ] **Step 4: Escreva `docs/lgpd/whatsapp-textos.md`** com três textos prontos para colar:
  1. a frase da descrição dos grupos monitorados, exatamente como está no spec: "Este grupo é acompanhado pela equipe IPEMaster, com apoio de ferramentas automáticas";
  2. o termo de ciência do vendedor: o número é da empresa, as conversas de trabalho são guardadas por 90 dias para qualidade do atendimento, e conversas pessoais podem ser marcadas como "pessoal" e são apagadas;
  3. o trecho da política de privacidade: finalidade, base legal (legítimo interesse), retenção de 90 dias, Anthropic como operador nos resumos (entrega 3), sem uso para treino, e como pedir a exclusão.

  Diga no topo que o texto final precisa da revisão de quem cuida do jurídico.
- [ ] **Step 5:** Rode todos os testes (`npx vitest run`), `npm run typecheck` e `npx eslint src/modulos/whatsapp "src/app/(app)/admin/saude"`. Esperado: PASS.
- [ ] **Step 6: Commit** `feat(whatsapp): tela de saúde em /admin/saude e textos de LGPD`.

---

**Fora desta entrega (decidido):**
- **Retenção de 1 ano para resumos e avaliações:** vai para a entrega 3, que cria essas tabelas.
- **Contador de lotes descartados:** fica só no log do motor (`[fila] lote ... descartado`), lido pelo `journalctl`. Guardar no servidor pediria uma tabela de estado do motor só para isso.
- **Juntar conversas `@lid` duplicadas que já existem:** não entra. A tarefa 4 evita duplicadas novas, e as antigas somem pela retenção.
- **Contratar a VPS e ler o QR nela:** são passos do Gustavo, seguindo o runbook da tarefa 2, depois do push.
