# WhatsApp entrega 4: tempos de resposta e tempo da CS (plano de implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo.** A gestão vê, sem IA, quanto cada número leva para responder, quem está sem resposta, a taxa de follow-up e quanto a CS leva da venda até o primeiro contato. Os números são exatos e batem com uma conferência manual.

**Arquitetura.**
- **Regras puras** em `src/modulos/whatsapp/regras/`:
  - minutos dentro do horário comercial;
  - vezes do cliente e follow-ups de uma conversa;
  - situação de cada venda na CS.
- **Cron `metricas-whatsapp`**, de hora em hora: recalcula hoje e os 4 dias anteriores em `MetricaAtendimentoDia`, uma linha por número e por dia.
- **Telas ao vivo:** "Sem resposta agora" e a aba CS são calculadas na hora. A CS lê `Venda` + mensagens, e o volume é pequeno.
- **Abas novas:** Atendimento e CS, só para a gestão.

**Tecnologia.** Next.js 16 (App Router, Server Actions), Prisma 7 + MySQL, zod, Recharts 3.10.1 (já usado no Comercial), Vitest.

**Spec.** `docs/superpowers/specs/2026-11-18-whatsapp-ia-e-atendimento-design.md`, seções 5, 7, 9, 12a e 13. Leia também a regra 7 da seção 4 do spec base, `docs/superpowers/specs/2026-11-17-whatsapp-design.md`.

## Restrições globais
- **Nunca use LIKE.** Proibido `contains`, `startsWith` e `endsWith` em consultas Prisma: dá erro de collation (P2039/1267) no MySQL da Hostinger. Os mocks de teste lançam erro nesses operadores (função `semLike`, copie de `servicos/saude.test.ts`). Telefone se busca com `variantesTelefone(chaveTelefone(x))` e `in`.
- **Fuso de São Paulo fixo em UTC-3.** Use `inicioDoDiaSaoPaulo` (`src/lib/ia/limites.ts`) e `diaEmSaoPaulo`/`somarDias` (`src/modulos/tarefas/regras/prazo.ts`). Campos `@db.Date` guardam a meia-noite UTC da data de São Paulo, como `janelaDeOntem` em `regras/dia.ts`.
- **Logs e respostas do cron:** nada de telefone, nome ou texto de mensagem. Só contagens.
- **Telas:** textos em português simples. Tempo aparece como "4 min", "1 h 05 min" ou "12 h 10 min". Sem dado, aparece "—", nunca "0 min" ou "NaN%".
- **Padrões do horário e do follow-up:**
  - horário comercial: segunda a sexta 8h–18h, sábado 8h–12h, domingo fechado;
  - SLA de 15 min;
  - follow-up devido após 24 h, prazo de 3 dias.
  - Todos são editáveis pelo admin.
- **Conversas que entram:** só individuais, de categoria `lead` ou `aluno`, de números não excluídos. Ficam de fora `equipe`, `pessoal`, `outro` e os grupos.
- **Respostas da empresa:** toda mensagem `deMim` conta como resposta humana. Os números não mandam mensagem automática.
- **Quem vê:**
  - Atendimento e CS exigem `whatsapp:ver_equipe` (admin e gestor).
  - Editar o time de um número exige `whatsapp:gerenciar_numeros`.
  - Editar as regras do atendimento exige papel `admin`, no mesmo padrão de `salvarLimiteIaWhatsappAcao`.
- **Migration** gerada com `npx prisma migrate diff --from-schema <schema do HEAD> --to-schema prisma/schema.prisma --script`, em `prisma/migrations/20261119100000_whatsapp_atendimento/migration.sql`.
- **Commits** só dos próprios arquivos: `git commit -m "..." -- <arquivos>`. Nunca `git add -A`, stash, reset ou troca de branch. Mensagens terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Verificação:** `npx vitest run <arquivo>` em cada tarefa e `npx tsc --noEmit` antes de commitar.

## Decisões deste plano (o spec deixou com o builder)
- **Início do tempo da CS.** O spec diz "depois que o primeiro número `cs` conectou", mas `conectadoEm` muda a cada reconexão, e isso faria vendas antigas sumirem. Por isso o número ganha `timeDesde`, gravado quando a gestão muda o time. Contam as vendas com `criadoEm >= min(timeDesde)` dos números `cs`.
- **CS sem tabela própria.** A aba CS calcula ao vivo, a partir de `Venda` e das mensagens. A linha diária de um número `cs` guarda só os tempos de resposta.
- **Medianas exatas na semana.** A linha diária guarda as durações em segundos (listas `Json`), e a semana junta as listas antes de tirar a mediana.
- **% no SLA:** respostas em até o SLA ÷ (respostas + vezes abertas que já passaram do SLA). Vezes abertas ainda dentro do SLA não entram.
- **Follow-up:**
  - Uma mensagem `deMim` cria um follow-up devido se a próxima mensagem da conversa vier depois de 24 h ou não vier.
  - A próxima mensagem da empresa em até 3 dias conta como **feito**.
  - Se o cliente responder primeiro, a cobrança é **cancelada** e não conta.
  - Passados 3 dias sem mensagem nenhuma, é **perdido**.
  - Antes disso fica **pendente** e não conta.
  - O follow-up conta no dia em que venceu (`E + 24 h`).
- **Recálculo:** o cron de hora em hora refaz hoje e os 4 dias anteriores, porque o follow-up se decide em até 3 dias. Se a tabela estiver vazia, refaz 35 dias de uma vez, para carregar o histórico.
- **Time na linha diária:** linhas de dias anteriores a hoje mantêm o `time` gravado. Só a linha de hoje, ou uma linha nova, recebe o time atual.
- **"Sem resposta" na tabela** é a contagem ao vivo, de agora. O total da semana só entra no % no SLA.
- **Semana** vai de segunda a domingo, no calendário de São Paulo. A escolha é `?semana=AAAA-MM-DD` (a segunda-feira), e o padrão é a semana atual. O gráfico mostra as 8 últimas semanas.
- **Regras editáveis** ficam no card "Regras do atendimento" da aba Atendimento, editável só pelo admin.
- **Retenção:** a linha diária fica 365 dias e é apagada pelo `limpar-whatsapp`. Não tem dado pessoal.

## Pontos de atenção na revisão
1. **Cliente escreve fora do horário.** Sexta 19h, resposta segunda 8h05: a resposta conta 5 min, não 61 h (teste na Tarefa 2).
2. **Telefone da venda em outro formato.** `whatsappCliente` "1199887766" (sem o 9) acha o contato gravado como "5511999887766" (teste na Tarefa 6).
3. **CS falou com a pessoa antes da venda.** Vale a primeira mensagem depois de `Venda.criadoEm` (teste na Tarefa 6).
4. **Mudança de time no meio da semana.** As linhas de dias anteriores ficam com o time antigo (teste na Tarefa 4).
5. **Semana sem mensagem num número.** A linha mostra "—" em tempos e % e não quebra (teste na Tarefa 7).

---

### Tarefa 1: Esquema, migration e regras do atendimento na configuração

**Arquivos:**
- Modificar: `prisma/schema.prisma`
- Criar: `prisma/migrations/20261119100000_whatsapp_atendimento/migration.sql`
- Modificar: `src/modulos/whatsapp/servicos/configuracao.ts`
- Criar: `src/modulos/whatsapp/esquemas/regras-atendimento.ts`
- Teste: `src/modulos/whatsapp/servicos/configuracao.test.ts`, `src/modulos/whatsapp/esquemas/esquemas.test.ts`

**Interfaces:**
- **Produz no esquema Prisma:**
  - `enum TimeNumeroWhatsapp { cs paciente_modelo comercial outro }`;
  - em `NumeroWhatsapp`: `time TimeNumeroWhatsapp @default(outro)`, `timeDesde DateTime? @map("time_desde")` e a relação `metricas MetricaAtendimentoDia[]`;
  - em `ConfiguracaoWhatsapp`: `regrasAtendimento Json? @map("regras_atendimento")`.
- **Produz o modelo** `MetricaAtendimentoDia` (`@@map("metricas_atendimento_dia")`):
  - campos: `id` (cuid), `numeroId`, `dia @db.Date`, `time TimeNumeroWhatsapp`, `conversasComCliente Int`, `primeirasRespostasSeg Json`, `respostasSeg Json`, `respostasNoSla Int`, `semResposta Int`, `followupsFeitos Int`, `followupsPerdidos Int`, `criadoEm`, `atualizadoEm @updatedAt`;
  - `@@unique([numeroId, dia])`, `@@index([dia])`;
  - relação com `NumeroWhatsapp`.
- **Produz em `esquemas/regras-atendimento.ts`:**
  - `type FaixaHorario = { inicioMin: number; fimMin: number }`;
  - `type RegrasAtendimento = { horario: (FaixaHorario | null)[]; slaMinutos: number; followupHoras: number; followupDias: number }`. `horario` tem 7 posições, de domingo (0) a sábado (6), em minutos desde a meia-noite de São Paulo;
  - `REGRAS_PADRAO: RegrasAtendimento`, com seg–sex `{480, 1080}`, sáb `{480, 720}`, dom `null`, SLA 15, follow-up 24 h e 3 dias;
  - `esquemaRegrasAtendimento` (zod): 7 posições; `0 <= inicioMin < fimMin <= 1440`; `slaMinutos` inteiro de 1 a 240; `followupHoras` de 1 a 168; `followupDias` de 1 a 14; `followupDias * 24 > followupHoras`.
- **Produz em `servicos/configuracao.ts`:**
  - `obterRegrasAtendimento(): Promise<RegrasAtendimento>` (sem linha ou com Json inválido, devolve `REGRAS_PADRAO`);
  - `salvarRegrasAtendimento(dados: unknown, atorId: string): Promise<void>`: valida, faz upsert na linha "unica" (cria com o modelo e o limite padrão) e grava a auditoria `whatsapp.regras_atendimento_alteradas` com as regras no `diff`.

- [ ] **Passo 1: testes que falham.**
  - **Arquivo `esquemas.test.ts`:**
    - `esquemaRegrasAtendimento aceita REGRAS_PADRAO`;
    - `recusa faixa com inicioMin >= fimMin`;
    - `recusa horario com 6 posições`;
    - `recusa slaMinutos 0`;
    - `recusa followupDias 1 com followupHoras 24`.
  - **Arquivo `configuracao.test.ts`:**
    - `obterRegrasAtendimento sem linha devolve REGRAS_PADRAO`;
    - `obterRegrasAtendimento com Json inválido devolve REGRAS_PADRAO`;
    - `salvarRegrasAtendimento grava e audita` (confere `acao: "whatsapp.regras_atendimento_alteradas"`);
    - `salvarRegrasAtendimento com SLA 0 lança ErroNegocio e não grava`.
- [ ] **Passo 2:** `npx vitest run src/modulos/whatsapp/servicos/configuracao.test.ts src/modulos/whatsapp/esquemas/esquemas.test.ts`. Esperado: falha.
- [ ] **Passo 3:** mudar o esquema, gerar a migration com `migrate diff` e rodar `npx prisma generate`. Implementar o esquema zod e os dois serviços. Um erro de zod vira `ErroNegocio` com a primeira mensagem.
- [ ] **Passo 4:** rodar os testes de novo (esperado: passam) e depois `npx tsc --noEmit`.
- [ ] **Passo 5:** commit `feat(whatsapp): time do número, métricas diárias e regras do atendimento`.

### Tarefa 2: Tempo dentro do horário comercial

**Arquivos:**
- Criar: `src/modulos/whatsapp/regras/horario.ts`
- Teste: `src/modulos/whatsapp/regras/horario.test.ts`

**Interfaces:**
- **Consome:** `RegrasAtendimento["horario"]` da Tarefa 1.
- **Produz:**
  - `segundosUteis(inicio: Date, fim: Date, horario: (FaixaHorario | null)[]): number`: segundos dentro das faixas entre `inicio` e `fim`, em São Paulo (UTC-3). Devolve 0 se `fim <= inicio`.
  - `formatarDuracao(segundos: number | null): string`: `null` vira "—", menos de 60 s vira "menos de 1 min", menos de 1 h vira "N min", e de 1 h para cima vira "H h MM min" (por exemplo, "12 h 10 min").

- [ ] **Passo 1: testes que falham** (as horas abaixo são de São Paulo; nos testes, use datas `...-03:00`).
  - `segunda 9h00 a 9h12 = 720`;
  - `sexta 19h a segunda 8h05 = 300`;
  - `sábado 11h50 a segunda 8h10 = 1200` (10 min no sábado e 10 min na segunda);
  - `domingo inteiro = 0`;
  - `terça 17h a quarta 9h = 7200`;
  - `fim antes do início = 0`;
  - `formatarDuracao(null) = "—"`, `formatarDuracao(30) = "menos de 1 min"`, `formatarDuracao(540) = "9 min"`, `formatarDuracao(43800) = "12 h 10 min"`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar. Percorra dia a dia no calendário de São Paulo e some a interseção de `[inicio, fim)` com a faixa de cada dia.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(whatsapp): tempo dentro do horário comercial`.

### Tarefa 3: Vezes do cliente, follow-up e métricas de um dia (regra pura)

**Arquivos:**
- Criar: `src/modulos/whatsapp/regras/atendimento.ts`
- Teste: `src/modulos/whatsapp/regras/atendimento.test.ts`

**Interfaces:**
- **Consome:** `segundosUteis` (Tarefa 2) e `RegrasAtendimento` (Tarefa 1).
- **Produz:**
  - `type MensagemTempo = { deMim: boolean; enviadaEm: Date }`.
  - `type Vez = { inicio: Date; respondidaEm: Date | null; segundos: number }`. `segundos` são úteis até a resposta ou, se a vez está aberta, até `agora`.
  - `type Followup = { devidoEm: Date; resultado: "feito" | "perdido" | "pendente" | "cancelado" }`.
  - `eventosDaConversa(mensagens: MensagemTempo[], agora: Date, regras: RegrasAtendimento): { vezes: Vez[]; followups: Followup[] }`. As mensagens chegam em ordem crescente.
    - Uma vez começa na primeira mensagem do cliente da conversa, ou na primeira dele depois de uma `deMim`. Termina na próxima `deMim`.
    - Para o follow-up, siga a seção "Decisões" deste plano: a mensagem seguinte decide o resultado (`deMim` em até `followupDias` vira feito; cliente vira cancelado; nada até `E + followupDias` vira perdido; antes disso, pendente).
  - `type LinhaDia = { conversasComCliente: number; primeirasRespostasSeg: number[]; respostasSeg: number[]; respostasNoSla: number; semResposta: number; followupsFeitos: number; followupsPerdidos: number }`.
  - `metricasDoDia(conversas: { mensagens: MensagemTempo[] }[], dia: string, agora: Date, regras: RegrasAtendimento): LinhaDia`. `dia` é "AAAA-MM-DD" de São Paulo.
    - Uma vez conta no dia em que começou.
    - A primeira resposta do dia é a primeira vez daquele dia na conversa, se foi respondida.
    - `semResposta` conta as vezes do dia ainda abertas com `segundos > slaMinutos * 60`.
    - O follow-up conta no dia de `devidoEm`.
    - `conversasComCliente` conta as conversas com mensagem do cliente naquele dia.
  - `mediana(valores: number[]): number | null`: com tamanho par, é a média dos dois do meio, arredondada.
  - `percentual(parte: number, total: number): number | null`: inteiro de 0 a 100, e `null` se `total` for 0.

- [ ] **Passo 1: testes que falham.**
  - `cliente-cliente-empresa forma uma vez só, do primeiro cliente até a empresa`.
  - `conversa só com mensagens da empresa não tem vez`.
  - `vez aberta conta segundos úteis até agora`.
  - **Follow-up:**
    - `empresa 10h, nada mais, agora +2 dias → follow-up pendente`;
    - `empresa 10h, empresa de novo +30 h → feito com devidoEm = +24 h`;
    - `empresa 10h, cliente +30 h → cancelado`;
    - `empresa 10h, nada por 4 dias → perdido`;
    - `empresa 10h, empresa de novo +2 h → sem follow-up para a primeira`.
  - **Métricas do dia:**
    - `metricasDoDia: vez que começa 23h50 e termina 0h10 conta no dia em que começou`;
    - `metricasDoDia: primeira resposta é só a da primeira vez do dia`;
    - `metricasDoDia: vez aberta com 20 min úteis conta em semResposta com SLA 15`;
    - `metricasDoDia: resposta de 15 min exatos conta dentro do SLA`.
  - **Funções de apoio:**
    - `mediana([]) = null`, `mediana([3,1,2]) = 2`, `mediana([1,2,3,4]) = 3` (média 2,5 arredondada para 3);
    - `percentual(0,0) = null`, `percentual(9,10) = 90`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(whatsapp): vezes do cliente, follow-up e métricas do dia`.

### Tarefa 4: Recálculo das métricas, cron e limpeza

**Arquivos:**
- Criar: `src/modulos/whatsapp/servicos/metricas.ts`
- Modificar: `src/app/api/cron/[tarefa]/route.ts`, `src/modulos/whatsapp/servicos/limpeza.ts`, `docs/runbooks/whatsapp-motor-vps.md` (seção 18)
- Teste: `src/modulos/whatsapp/servicos/metricas.test.ts`, `src/modulos/whatsapp/servicos/limpeza.test.ts`

**Interfaces:**
- **Consome:** `eventosDaConversa`/`metricasDoDia` (Tarefa 3), `obterRegrasAtendimento` (Tarefa 1) e `diaEmSaoPaulo`/`somarDias`.
- **Produz:**
  - `recalcularMetricas(agora?: Date): Promise<{ dias: number; linhas: number }>`.
  - **Dias recalculados:** hoje e os 4 anteriores, ou 35 dias se `metricaAtendimentoDia.count()` for 0.
  - **Conversas lidas:** individuais, `categoria in [lead, aluno]`, de números com `excluidoEm: null`. As mensagens são lidas desde (primeiro dia − 7 dias), com `select` só de `conversaId`, `deMim` e `enviadaEm`, em ordem por `enviadaEm`.
  - **Gravação:** faz upsert por (`numeroId`, `dia`) para cada número não excluído e cada dia, inclusive com zeros.
  - **Time na linha:** ao atualizar uma linha de dia anterior a hoje, não muda o `time` dela. A linha de hoje e as linhas novas recebem o `time` atual do número.
- **Cron:** tarefa `"metricas-whatsapp": async () => ({ ok: true, ...(await recalcularMetricas()) })`.
- **Limpeza:** `limparWhatsapp` também apaga `MetricaAtendimentoDia` com `dia` de mais de 365 dias, e devolve `metricasAntigas: number`. A resposta do cron `limpar-whatsapp` passa a incluir essa contagem.
- **Runbook:** a seção 18 ganha a linha `10 * * * * curl -fsS --max-time 600 -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/metricas-whatsapp` e uma frase explicando o que ela faz.

- [ ] **Passo 1: testes que falham** (mock em memória no padrão de `saude.test.ts`, com `semLike`).
  - `tabela vazia recalcula 35 dias`.
  - `com linhas recalcula 5 dias`.
  - `grava linha com zeros para número sem conversa`.
  - `ignora conversa de categoria equipe e grupos`.
  - `linha de ontem mantém o time antigo depois que o número mudou de time; linha de hoje recebe o novo`.
  - `consulta de mensagens não pede o campo texto`.
  - **Limpeza:** `limparWhatsapp apaga métrica de 366 dias e mantém a de 364`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar o serviço, o cron, a limpeza e o runbook.
- [ ] **Passo 4:** rodar os testes de novo (esperado: passam) e depois `npx tsc --noEmit`.
- [ ] **Passo 5:** commit `feat(whatsapp): cron de métricas do atendimento`.

### Tarefa 5: Time do número na tela Números

**Arquivos:**
- Modificar: `src/modulos/whatsapp/servicos/numeros.ts`, `src/modulos/whatsapp/acoes/numeros.ts`, `src/modulos/whatsapp/componentes/lista-numeros.tsx`, `src/app/(app)/whatsapp/numeros/page.tsx`
- Teste: `src/modulos/whatsapp/servicos/numeros.test.ts`, `src/modulos/whatsapp/acoes/numeros.test.ts`

**Interfaces:**
- **Produz:**
  - `NumeroNaTela.time: TimeNumeroWhatsapp`.
  - `ROTULO_TIME = { cs: "CS", paciente_modelo: "Paciente modelo", comercial: "Comercial", outro: "Outro" }`, exportado de `src/modulos/whatsapp/regras/time.ts` (arquivo novo, sem "use client"; a página do servidor não pode importar constante de arquivo cliente).
  - `alterarTimeNumero(ator: UsuarioAtual, numeroId: string, time: TimeNumeroWhatsapp): Promise<void>`:
    - exige `whatsapp:gerenciar_numeros`;
    - número excluído ou inexistente lança `ErroNegocio("Número não encontrado.")`;
    - com o mesmo time, não faz nada;
    - com outro time, grava o `time` e `timeDesde = agora`, mais a auditoria `whatsapp.time_alterado` com `diff: { de, para }`.
  - `alterarTimeNumeroAcao(dados: unknown): Promise<EstadoAcao>`, com zod `{ numeroId, time }`, revalidando `/whatsapp/numeros`.
- **Tela:** a coluna "Time" mostra um seletor para quem tem `whatsapp:gerenciar_numeros` e o texto para os demais.

- [ ] **Passo 1: testes que falham.**
  - `alterarTimeNumero grava time, timeDesde e auditoria`.
  - `mesmo time não grava nem audita`.
  - `comercial não altera (ErroPermissao)`.
  - `número excluído lança Número não encontrado`.
  - `ação recusa time desconhecido`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar o serviço, a ação, a constante e a coluna da tela.
- [ ] **Passo 4:** rodar os testes de novo (esperado: passam) e depois `npx tsc --noEmit`.
- [ ] **Passo 5:** commit `feat(whatsapp): time do número na tela Números`.

### Tarefa 6: Tempo da CS (regra e serviço)

**Arquivos:**
- Criar: `src/modulos/whatsapp/regras/cs.ts`, `src/modulos/whatsapp/servicos/cs.ts`
- Teste: `src/modulos/whatsapp/regras/cs.test.ts`, `src/modulos/whatsapp/servicos/cs.test.ts`

**Interfaces:**
- **Consome:** `chaveTelefone`, `variantesTelefone`, `mediana` (Tarefa 3) e `time`/`timeDesde` (Tarefas 1 e 5).
- **Produz em `regras/cs.ts`:**
  - `DIAS_SEM_CONTATO = 7`.
  - `situacaoVendaCs(criadoEm: Date, temWhatsapp: boolean, enviosCs: Date[], agora: Date): { situacao: "contatada" | "aguardando" | "sem_contato" | "sem_whatsapp"; primeiroContatoEm: Date | null; segundos: number | null }`.
    - `enviosCs` são as mensagens `deMim` dos números `cs` para o contato, em ordem crescente.
    - Vale o primeiro envio `>= criadoEm`. `segundos` são corridos.
    - Sem envio: `aguardando` (segundos até agora) se tiver 7 dias ou menos; depois disso, `sem_contato` (segundos `null`).
- **Produz em `servicos/cs.ts`:**
  - `type VendaCs = { id; produto: string; cliente: string; criadoEm: Date; situacao; primeiroContatoEm: Date | null; segundos: number | null; conversaId: string | null }`.
  - `listarVendasCs(ator: UsuarioAtual, inicio: Date, fim: Date, agora?: Date): Promise<{ semNumeroCs: boolean; vendas: VendaCs[]; medianaSeg: number | null; aguardando: number }>`.
    - Exige `whatsapp:ver_equipe`.
    - Entram as vendas com `excluidoEm: null`, `criadoEm` em `[max(inicio, csDesde), fim)`, onde `csDesde` é o menor `timeDesde` dos números `cs` não excluídos.
    - Sem número `cs`: devolve `semNumeroCs: true` e a lista vazia.
    - Contatos achados por `telefone in variantes`, e envios lidos de uma vez. Nada de consulta por venda.
    - `conversaId` é a conversa individual `cs` do primeiro envio, ou a mais recente com o contato.
    - Ordem: `aguardando` primeiro (o mais antigo no topo); depois o resto por `criadoEm` decrescente.
    - A mediana considera só `contatada`.
  - `evolucaoCs(ator: UsuarioAtual, semanas: { inicio: Date; fim: Date; rotulo: string }[], agora?: Date): Promise<{ rotulo: string; medianaSeg: number | null; vendas: number }[]>`.

- [ ] **Passo 1: testes que falham.**
  - **Regra:**
    - `primeiro envio depois da venda vale; envio de antes não conta`;
    - `sem envio há 3 h → aguardando com 10800 s`;
    - `sem envio há 8 dias → sem_contato com segundos null`;
    - `sem WhatsApp → sem_whatsapp`.
  - **Serviço:**
    - `venda "1199887766" acha contato "5511999887766"`;
    - `venda criada antes do timeDesde da CS fica de fora`;
    - `mensagem de número paciente_modelo não conta como contato da CS`;
    - `aguardando vêm primeiro`;
    - `sem número cs → semNumeroCs true`;
    - `comercial lança ErroPermissao`;
    - `nenhuma consulta usa LIKE`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar os testes de novo (esperado: passam) e depois `npx tsc --noEmit`.
- [ ] **Passo 5:** commit `feat(whatsapp): tempo da venda até o primeiro contato da CS`.

### Tarefa 7: Aba Atendimento

**Arquivos:**
- Modificar: `src/modulos/whatsapp/regras/dia.ts` (semanas)
- Criar:
  - `src/modulos/whatsapp/servicos/painel-atendimento.ts`;
  - `src/app/(app)/whatsapp/atendimento/page.tsx`;
  - `src/modulos/whatsapp/componentes/tabela-atendimento.tsx`;
  - `src/modulos/whatsapp/componentes/grafico-atendimento.tsx` ("use client", Recharts `LineChart`, no estilo de `src/modulos/tarefas/componentes/grafico-entregas.tsx`);
  - `src/modulos/whatsapp/componentes/regras-atendimento.tsx` (formulário do admin).
- Modificar: `src/modulos/whatsapp/componentes/abas-whatsapp.tsx`, `src/modulos/whatsapp/acoes/numeros.ts` (ação das regras)
- Teste: `src/modulos/whatsapp/regras/dia.test.ts`, `src/modulos/whatsapp/servicos/painel-atendimento.test.ts`, `src/modulos/whatsapp/acoes/numeros.test.ts`

**Interfaces:**
- **Produz em `regras/dia.ts`:**
  - `semanaDaConsulta(valor: string | undefined, agora: Date): { inicio: Date; fim: Date; texto: string; rotulo: string }`. `inicio` é a meia-noite de São Paulo da segunda-feira, como instante. Valor inválido ou que não cai numa segunda vira a semana atual. O `rotulo` tem o formato "16/11 a 22/11".
  - `ultimasSemanas(agora: Date, n: number)`: lista do mesmo tipo, da mais antiga para a atual.
- **Produz em `servicos/painel-atendimento.ts`** (os três exigem `whatsapp:ver_equipe`):
  - `resumoDaSemana(ator, semana)`:
    - devolve uma linha por número não excluído: `{ numeroId, nome, dono, time, conversas, primeiraRespostaSeg, respostaSeg, noSlaPct, followupPct, semRespostaAgora }`;
    - junta as listas das linhas diárias e tira a mediana;
    - `noSlaPct = percentual(Σ respostasNoSla, Σ respostas + Σ semResposta)`;
    - `followupPct = percentual(feitos, feitos + perdidos)`.
  - `evolucaoDoNumero(ator, numeroId, semanas)`: para cada semana, `{ rotulo, primeiraRespostaMin, respostaMin, noSlaPct, followupPct }`, com `null` onde não há dado.
  - `semRespostaAgora(ator, agora?)`: lista ao vivo `{ conversaId, numeroNome, contatoNome, desde: Date, segundos }` das conversas `lead`/`aluno` cuja última vez está aberta e passou do SLA, da maior espera para a menor. Lê só as conversas com `ultimaMensagemEm` nos últimos 7 dias.
- **Ação:** `salvarRegrasAtendimentoAcao(dados: unknown): Promise<EstadoAcao>`, só admin (`exigirPermissao("whatsapp:ver_equipe")` mais checagem de `papel === "admin"`), revalidando `/whatsapp/atendimento`.
- **Página `/whatsapp/atendimento`** (`exigirPermissaoPagina("whatsapp:ver_equipe")`):
  - seletor de semana (`?semana=`);
  - tabela com as colunas Número, Time, Conversas, 1ª resposta, Resposta, No SLA, Follow-up e Sem resposta agora;
  - clicar num número abre `?numero=<id>`, com o gráfico de 8 semanas e a lista "Sem resposta agora" daquele número;
  - sem número: a lista geral;
  - card "Regras do atendimento", com o formulário para o admin e o texto das regras para o gestor;
  - os tempos são formatados com `formatarDuracao`.
- **Abas:** a ordem fica Grupos, Atendimento, CS, Conversas, Números. Atendimento e CS usam `permissoes: ["whatsapp:ver_equipe"]`.

- [ ] **Passo 1: testes que falham.**
  - **Semanas:**
    - `semanaDaConsulta("2026-11-16") começa segunda 16/11 3h UTC`;
    - `semanaDaConsulta("2026-11-17") (terça) vira a semana atual`;
    - `ultimasSemanas(agora, 8) tem 8 itens terminando na atual`.
  - **Resumo da semana:**
    - `resumoDaSemana junta as listas antes da mediana` (dia 1 `[60, 120]` e dia 2 `[600]` dão 120);
    - `número sem linhas na semana dá tempos null e pct null`;
    - `noSlaPct conta semResposta no total`.
  - **Sem resposta agora:**
    - `semRespostaAgora ignora vez aberta dentro do SLA e conversa equipe`;
    - `comercial lança ErroPermissao nos três`.
  - **Ação:** `salvarRegrasAtendimentoAcao recusa gestor`.
  - **Abas:** `abasDoPapel("gestor") inclui atendimento e cs; abasDoPapel("comercial") não inclui`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar o serviço, a ação, a página, os componentes e as abas.
- [ ] **Passo 4:** rodar os testes de novo (esperado: passam), depois `npx tsc --noEmit` e `npx next build --webpack`. Esperado: o build termina, e a rota `/whatsapp/atendimento` aparece na lista.
- [ ] **Passo 5:** commit `feat(whatsapp): aba Atendimento com tempos e evolução semanal`.

### Tarefa 8: Aba CS

**Arquivos:**
- Criar: `src/app/(app)/whatsapp/cs/page.tsx`, `src/modulos/whatsapp/componentes/tabela-cs.tsx`
- Reusar: `grafico-atendimento.tsx` (Tarefa 7). Se precisar, generalize-o com as séries como propriedade.

**Interfaces:**
- **Consome:** `listarVendasCs` e `evolucaoCs` (Tarefa 6), `semanaDaConsulta` e `ultimasSemanas` (Tarefa 7), `formatarDuracao`.
- **Página `/whatsapp/cs`** (`exigirPermissaoPagina("whatsapp:ver_equipe")`):
  - cabeçalho com a mediana até o primeiro contato e quantas aguardam;
  - seletor de semana;
  - tabela com Venda (produto), Cliente (link para `/whatsapp/conversas/<conversaId>` quando houver), Saiu, 1º contato e Tempo;
  - rótulos por situação: "aguardando" com o tempo correndo, "sem contato em 7 dias", "sem WhatsApp na venda";
  - gráfico de 8 semanas com a mediana em horas.
  - Com `semNumeroCs`: estado vazio "Marque um número como CS na tela Números para medir o primeiro contato."

- [ ] **Passo 1:** a página não tem lógica própria além da formatação; os testes estão na Tarefa 6. Escreva o teste `tabela-cs: rótulo por situação`, cobrindo a função pura `rotuloSituacaoCs(situacao, segundos)` que fica em `regras/cs.ts`, para as quatro situações.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar o teste de novo (esperado: passa), depois `npx tsc --noEmit` e `npx next build --webpack`. Esperado: a rota `/whatsapp/cs` aparece na lista.
- [ ] **Passo 5:** commit `feat(whatsapp): aba CS com tempo até o primeiro contato`.

## Depois do envio (com o Gustavo)
1. Criar o cron `10 * * * *` `metricas-whatsapp` no hPanel, copiando o comando de um cron que já existe.
2. Na tela Números, marcar o time de cada número (CS, Paciente modelo, Comercial). O tempo da CS conta a partir desse momento.
3. Conferir à mão três conversas contra a tela Atendimento. Esse é o critério de pronto da entrega 4 no spec base.
