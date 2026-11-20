# WhatsApp entrega 5 — Avaliação das conversas e aba Leads — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda madrugada, a IA avalia cada conversa individual de lead ou aluno que teve mensagem ontem nos números `cs`, `paciente_modelo` e `comercial`. A avaliação dá nota por critério, situação do lead, temperatura e próximo passo. A gestão vê tudo na aba Leads, na aba Atendimento (nota média e piores notas) e na página da conversa.

**Architecture:**
- Reaproveita a esteira de lotes da entrega 3 (`servicos/lote-ia.ts`). O cron `ia-whatsapp` cria o lote de resumos e, depois, o de avaliações. O cron `coletar-ia-whatsapp` coleta os dois tipos, então não há cron novo.
- A montagem do pedido é pura e fica em `ia/avaliacao-conversa.ts`.
- As notas calculadas pelo sistema (tempo e nota geral) ficam em `regras/avaliacao.ts`.
- A avaliação guarda o `time` do número no dia, como as métricas da entrega 4.

**Tech Stack:** Next.js 16 App Router (Server Components e Server Actions), Prisma 7 + MySQL (Hostinger), zod, @anthropic-ai/sdk (Message Batches), Recharts 3.10.1, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-whatsapp-ia-e-atendimento-design.md`, seções 5, 8, 9, 10, 11, 12a e 13. Onde ele divergir do spec base `2026-11-17-whatsapp-design.md`, vale ele.

## Global Constraints

- **Modelo:** a avaliação usa sempre `claude-sonnet-5-5`, uma decisão do Gustavo em 2026-11-19 para caber no orçamento. Os resumos continuam com `ConfiguracaoWhatsapp.modelo` (Opus). O modelo da avaliação é uma constante, `MODELO_AVALIACAO`, sem tela para trocar.
- **Pedido:** `output_config: { effort: "medium", format: { type: "json_schema", schema } }`, `max_tokens` 16 000 e sem `thinking`, igual ao pedido do resumo.
- **Verba:** o limite mensal é um só, `ConfiguracaoWhatsapp.limiteMensalMicroUsd` (US$ 80), compartilhado com os resumos. Os resumos vêm primeiro. As avaliações que não cabem ficam `falhou` com `ERRO_LIMITE_MENSAL`, e a aba Leads avisa.
- **Nunca LIKE:** não use `contains`, `startsWith` nem `endsWith` no Prisma (erro P2039/1267 de collation na Hostinger). Telefone se compara com `variantesTelefone(chaveTelefone(x))` e `in`. Os mocks de teste usam a guarda `semLike` que já existe.
- **Datas:** São Paulo é UTC-3 fixo. `@db.Date` guarda a meia-noite UTC da data de São Paulo. Use `janelaDeOntem`.
- **LGPD:** para a IA vão só os papéis `Cliente` e `Atendente` e o texto. Nunca vai telefone, nome do contato, nome do número nem id. O log nunca leva texto de mensagem nem telefone. As avaliações ficam 365 dias.
- **Permissão:** a aba Leads, a nota na aba Atendimento e a avaliação na página da conversa exigem `whatsapp:ver_equipe` (admin e gestor). O vendedor não vê avaliações.
- **Textos de tela em português do Brasil**, com acentos. As mensagens de validação do zod também.
- **custom_id:** só `^[a-zA-Z0-9_-]{1,64}$`. O prefixo das avaliações é `aval_`, e o dos resumos continua `resumo_`.
- **Commits:** só os próprios arquivos, com `git commit -m ... -- <arquivos>`. Nunca `git add -A`, stash, reset ou trocar de branch. Push só com o OK do Gustavo.

## Review Focus

1. **Duas cobranças:** um item coletado duas vezes, ou um lote de resumo e um de avaliação abertos ao mesmo tempo, não pode registrar o uso duas vezes nem regravar uma avaliação `pronta`. O teste da Task 4 cobre a coleta repetida com os dois tipos.
2. **Verba compartilhada:** às 4h30 o lote de resumos acabou de ser enviado e ainda não foi cobrado. A avaliação precisa descontar a estimativa dos itens `pendente`, senão estoura o limite. Há teste na Task 3.
3. **Critério que não se aplica:** a nota fica `null`, não entra na média e aparece como "não se aplica". Uma conversa só com mensagens da empresa, sem nenhuma vez do cliente, tem nota de tempo `null`. Testes na Task 2.
4. **Telefone vazando:** um contato cujo `nomeExibido` é o próprio telefone, ou um texto de mensagem com o nome do número, não pode levar nome nem telefone na entrada. A entrada usa só papéis. Teste na Task 2.
5. **Venda casada com outra pessoa:** o mesmo telefone em formatos diferentes (com e sem 55, com e sem o 9) tem que casar. Uma venda de outro telefone, ou uma venda excluída, não casa. Teste na Task 3.

---

### Task 1: Banco — avaliação da conversa

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261120100000_whatsapp_avaliacoes/migration.sql`. Gere com `npx prisma migrate diff --from-schema <schema do HEAD salvo num arquivo temporário> --to-schema prisma/schema.prisma --script` e use `DATABASE_URL=mysql://u:p@127.0.0.1:3306/x`.
- Modify: `src/modulos/whatsapp/servicos/limpeza.ts` e `limpeza.test.ts`
- Modify: `src/modulos/whatsapp/servicos/titular.test.ts`
- Modify: `src/app/api/cron/[tarefa]/route.ts`, só se o retorno de `limparWhatsapp` aparecer lá campo a campo.

**Interfaces:**
- Produces: enum `SituacaoLead { novo qualificando interessado objecao negociando sem_retorno fechou perdido }`, enum `TemperaturaLead { quente morno frio }` e o model `AvaliacaoConversa`:
  - `id`, `conversaId`, `numeroId` e `dia @db.Date`;
  - `time TimeNumeroWhatsapp`, o time do número quando a avaliação foi criada;
  - `loteId String?`, `situacao SituacaoResumo @default(pendente)` e `erro VarChar(255)?`;
  - `modelo VarChar(60)`;
  - `situacaoLead SituacaoLead?`, `temperatura TemperaturaLead?`, `motivoTemperatura Text?`, `oQueRespondeu Text?` e `proximoPasso Text?`;
  - `criterios Json?`, uma lista `{ chave, nota: number|null, frase }` que já inclui a nota de tempo do sistema;
  - `notaTempo Int?`, calculada na criação, de 0 a 10;
  - `notaGeralDecimos Int?`, de 0 a 100: a nota geral × 10, para evitar ponto flutuante;
  - `pontosFortes Text?` e `melhorar Text?`;
  - `vendaId String?`;
  - `criadoEm` e `atualizadoEm`.
  
  Relações:
  - conversa com `onDelete: Cascade`;
  - numero sem cascade, como `MetricaAtendimentoDia`;
  - lote `LoteIa?` com `SetNull`;
  - venda `Venda?` com `SetNull`.
  
  Índices: `@@unique([conversaId, dia])`, `@@index([dia])`, `@@index([numeroId, dia])` e `@@map("avaliacoes_conversa")`. `LoteIa` ganha `avaliacoes AvaliacaoConversa[]`, `ConversaWhatsapp`, `NumeroWhatsapp` e `Venda` ganham a lista inversa, e `TipoLoteIa.avaliacao` já existe.
- `limparWhatsapp` passa a devolver também `avaliacoesAntigas: number`.

- [ ] **Step 1: Testes que falham.**
  - Em `limpeza.test.ts`: `limparWhatsapp apaga avaliações com dia anterior a 365 dias` chama `avaliacaoConversa.deleteMany` com `{ where: { dia: { lt: <agora − 365 dias> } } }`, e o retorno traz `avaliacoesAntigas`.
  - Em `titular.test.ts`: `apagar os dados do telefone apaga as conversas individuais, e as avaliações saem em cascata`. Confira que o serviço apaga as conversas pelo id. A cascata vem do banco, e o teste documenta a dependência num comentário.
- [ ] **Step 2:** Rode `npx vitest run src/modulos/whatsapp/servicos/limpeza.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Escreva o schema e a migration. Depois ponha a limpeza de 365 dias em `limparWhatsapp`, logo depois das métricas, e atualize o comentário da função.
- [ ] **Step 4:** Rode `npx prisma validate`, `npx prisma generate` e `npx vitest run src/modulos/whatsapp`. Esperado: tudo PASSA.
- [ ] **Step 5:** Commit `feat(whatsapp): tabela de avaliações das conversas`.

### Task 2: Montagem do pedido e notas do sistema (regra pura)

**Files:**
- Create: `src/modulos/whatsapp/regras/avaliacao.ts` e `avaliacao.test.ts`
- Create: `src/modulos/whatsapp/ia/avaliacao-conversa.ts` e `avaliacao-conversa.test.ts`

**Interfaces:**
- Consumes: `MensagemTempo`, `eventosDaConversa` e `RegrasAtendimento` da entrega 4, e `TimeNumeroWhatsapp`.
- Produces (`regras/avaliacao.ts`):
  - `type TipoAvaliacao = "vendas" | "cs"`;
  - `tipoDoTime(time): TipoAvaliacao | null`: `cs` vira `"cs"`, `paciente_modelo` e `comercial` viram `"vendas"`, e `outro` vira `null`;
  - `CRITERIOS: Record<TipoAvaliacao, readonly { chave: string; rotulo: string }[]>`:
    - vendas: `qualificacao` "Qualificação", `quebra_objecao` "Quebra de objeção", `followup` "Follow-up", `clareza_cordialidade` "Clareza e cordialidade" e `conducao_fechamento` "Conduziu para o fechamento";
    - cs: `cordialidade` "Cordialidade", `clareza` "Clareza", `resolveu_duvida` "Resolveu a dúvida" e `conduziu_proximo_passo` "Conduziu o próximo passo";
  - `CRITERIO_TEMPO = { chave: "tempo_resposta", rotulo: "Tempo de resposta (sistema)" }`;
  - `notaDeTempo(mensagensDeOntem: MensagemTempo[], todas: MensagemTempo[], fimDeOntem: Date, regras): number | null`: conta as vezes do cliente que começaram ontem, até o fim de ontem, e devolve `Math.round(10 * noSla / vezes)`. Uma vez sem resposta conta fora do SLA. Sem nenhuma vez ontem, devolve `null`;
  - `notaGeralDecimos(notas: (number|null)[]): number | null`: média das notas não nulas × 10, arredondada. Sem nenhuma nota, devolve `null`;
  - `formatarNota(decimos: number | null): string`: `"7,8"`, ou `"—"` quando é null.
- Produces (`ia/avaliacao-conversa.ts`):
  - `type MensagemParaAvaliacao = { enviadaEm: Date; deMim: boolean; tipo: string; texto: string | null }`;
  - `montarEntradaAvaliacao(mensagens, ontem: { inicio: Date; fim: Date }, tempos: { primeiraRespostaMin: number | null; respostaMin: number | null; noSla: string | null }): { texto: string; cortada: boolean }`:
    - cada linha é `[dd/mm hh:mm] Cliente: …` ou `[dd/mm hh:mm] Atendente: …`;
    - antes da primeira mensagem de ontem vai a linha `--- Ontem (dd/mm) ---`;
    - no topo vai o bloco "Tempos medidos pelo sistema (só para comentar)";
    - mídia sem texto usa os mesmos rótulos do resumo (`[áudio]` e os outros);
    - o limite é `LIMITE_ENTRADA_AVALIACAO = 60_000` caracteres. Acima dele, as mensagens mais antigas saem e entra o aviso `(Mensagens mais antigas foram omitidas.)`. As de ontem nunca saem antes das anteriores;
  - `ESQUEMA_AVALIACAO_VENDAS` e `ESQUEMA_AVALIACAO_CS`, em JSON Schema. Cada critério é `{ seAplica: boolean, nota: integer, frase: string }`. Evite tipo anulável: `seAplica: false` vira nota `null` no zod;
  - os campos de vendas são `situacao` (enum dos 8 valores), `temperatura` (enum dos 3), `motivoTemperatura`, `oQueRespondeu`, `proximoPasso`, `criterios` (objeto com uma chave por critério), `pontosFortes` e `melhorar`;
  - CS tem os mesmos campos, menos `situacao`, `temperatura` e `motivoTemperatura`;
  - `esquemaZodAvaliacaoVendas` e `esquemaZodAvaliacaoCs` prendem a nota entre 0 e 10, arredondam e transformam `seAplica:false` em `nota: null`;
  - `INSTRUCOES_AVALIACAO: Record<TipoAvaliacao, string>`. O texto vem abaixo;
  - `pedidoAvaliacao(customId, tipo, entrada): PedidoAvaliacao`, com `model: MODELO_AVALIACAO` (`"claude-sonnet-5-5"`) e `MAX_TOKENS_AVALIACAO = 16_000`.

O texto das instruções é escolha do implementador, mas precisa dizer:
- o que é o IPEMaster, uma escola, e o que é o time. Paciente modelo são leads das campanhas que agendam atendimento como paciente modelo, comercial são leads de cursos, e CS é o pós-venda e os alunos;
- cada critério, com uma frase do que é 0 e do que é 10;
- "se o critério não se aplica a esta conversa, `seAplica: false`";
- "não avalie tempo de resposta, o sistema mede";
- "nunca invente o que não está nas mensagens";
- "avalie com foco em ontem, usando os dias anteriores como contexto";
- "não inclua telefones nem nomes".

- [ ] **Step 1: Testes que falham** (`regras/avaliacao.test.ts`):
  - `notaDeTempo` com 4 vezes ontem, 3 no SLA, devolve `8`;
  - `notaDeTempo` sem vez do cliente ontem devolve `null`;
  - uma vez aberta no fim de ontem conta fora do SLA;
  - `notaGeralDecimos([8, null, 6, 7])` devolve `70`, e `notaGeralDecimos([null])` devolve `null`;
  - `tipoDoTime("outro")` devolve `null`, e `tipoDoTime("comercial")` devolve `"vendas"`;
  - `formatarNota(78)` devolve `"7,8"`.
- [ ] **Step 2: Testes que falham** (`ia/avaliacao-conversa.test.ts`):
  - a entrada usa só os papéis: uma mensagem `deMim` vira `Atendente:`, e a do cliente vira `Cliente:`. O tipo `MensagemParaAvaliacao` não tem campo de nome nem de telefone, então eles não têm como entrar;
  - a linha `--- Ontem (18/11) ---` aparece antes da primeira mensagem de 18/11 quando `ontem` é 18/11 em São Paulo;
  - `[17/11 22:30]` é o horário de São Paulo de `2026-11-18T01:30:00Z`;
  - acima de 60 000 caracteres, saem as mais antigas, vem o aviso, e a última de ontem continua;
  - no zod de vendas, `seAplica:false` vira `nota: null`, `nota: 14` vira `10` e `situacao` fora do enum é reprovada;
  - `pedidoAvaliacao("aval_x", "cs", "…").params.model === "claude-sonnet-5-5"`, com `output_config.effort === "medium"` e o esquema de CS;
  - `ESQUEMA_AVALIACAO_VENDAS` tem `additionalProperties: false` em todos os objetos.
- [ ] **Step 3:** Rode `npx vitest run src/modulos/whatsapp/regras/avaliacao.test.ts src/modulos/whatsapp/ia/avaliacao-conversa.test.ts`. Esperado: FALHA.
- [ ] **Step 4:** Implemente. Para a hora de São Paulo, use a mesma conta de `ia/resumo-grupo.ts` (desloca 3 h). Os rótulos de mídia podem ser exportados de lá em vez de copiados.
- [ ] **Step 5:** Rode os dois testes. Esperado: PASSA.
- [ ] **Step 6:** Commit `feat(whatsapp): montagem da avaliação das conversas e notas do sistema`.

### Task 3: Criar o lote de avaliações

**Files:**
- Modify: `src/modulos/whatsapp/servicos/lote-ia.ts`. Extraia o que for comum (cliente de lotes, reserva, envio) só onde não mudar o comportamento dos resumos.
- Create: `src/modulos/whatsapp/servicos/lote-avaliacao.ts` e `lote-avaliacao.test.ts`
- Modify: `src/app/api/cron/[tarefa]/route.ts`

**Interfaces:**
- Consumes: as Tasks 1 e 2, além de `ClienteLotes`, `LoteRecusadoError`, `ORIGEM_IA_WHATSAPP`, `ERRO_LIMITE_MENSAL`, `ERRO_ENVIO_LOTE` e `gastoMesMicroUsd`.
- Produces:
  - `criarLoteAvaliacoes(agora?: Date, cliente?: ClienteLotes | null): Promise<{ criado: boolean; pedidos: number; semVerba: number; motivo?: … }>`, com os mesmos motivos de `criarLoteDoDia`;
  - `reservaPendentesMicroUsd(): Promise<number>`: estimativa do custo dos resumos e das avaliações ainda `pendente`, por item;
  - `PREFIXO_AVALIACAO = "aval_"`.
  - O cron `ia-whatsapp` passa a devolver `{ ok: true, resumos: {...}, avaliacoes: {...} }`. Ele roda `criarLoteDoDia` primeiro. Se a criação dos resumos lançar erro, o erro vai para o log com `descreverErro` e as avaliações rodam mesmo assim.

**Regras do lote** (o que nem o spec nem a Task 2 decidem):
- **Candidatas:** conversas `tipo: "individual"` e `categoria in ["lead", "aluno"]`, de número com `excluidoEm: null` e `time in ["cs", "paciente_modelo", "comercial"]`, com mensagem em `[inicio, fim)` de ontem. Ficam de fora as que já têm avaliação `pronto` daquele dia.
  - Entrada: as mensagens dos 14 dias anteriores ao `fim` de ontem.
  - A busca é em lote, sem consulta por conversa. Faça como `semRespostaAgora`, em blocos de 1000 conversas.
- **Tempos para comentar:** saem de `eventosDaConversa` sobre as mensagens dos 14 dias, filtrando as vezes que começaram ontem. A primeira resposta e a resposta mediana vão em minutos, e o "No prazo" vai como `"3 de 4"`.
- **Venda casada** (só para o tipo vendas): uma `Venda` com `excluidoEm: null` e `criadoEm` entre `fim − 90 dias` e `fim`, cujo `whatsappCliente` normalizado bate com a chave do telefone do contato. Use `chaveTelefone` e `variantesTelefone` com `in`, numa consulta só para todas as candidatas. A mais recente vira `vendaId`. A situação vira `fechou` na coleta.
- **Verba:** `restante = limite − gastoMesMicroUsd("whatsapp") − reservaPendentesMicroUsd()`. Vendas entram antes de CS e, dentro de cada uma, quem tem mais mensagens ontem vem primeiro.
  - A estimativa de cada pedido é `calcularCustoMicroUsd("claude-sonnet-5-5", { entrada: ceil((instruções + texto)/3), saida: 3000 }, { lote: true })`.
  - Quem não cabe é gravado `falhou` com `ERRO_LIMITE_MENSAL`.
- **Reserva e envio:** iguais aos dos resumos. A reserva é `LoteIa` com `tipo: "avaliacao"` e o dia, e o único (tipo, dia) barra a execução dupla. Tratam-se da mesma forma o `envio_incerto`, a recusa 4xx, a gravação condicional que nunca mexe em uma `pronto`, e o P2002.
- **Gravação pendente:** `time`, `numeroId`, `modelo: "claude-sonnet-5-5"`, `notaTempo` e `vendaId` já vão na criação.

- [ ] **Step 1: Testes que falham** (`lote-avaliacao.test.ts`, com o mesmo estilo de mock de `lote-ia.test.ts` e a guarda `semLike`):
  - só entram conversas `lead` e `aluno` de números `cs`, `paciente_modelo` e `comercial`. Número `outro`, conversa `equipe` e número excluído ficam fora;
  - o pedido de um número `cs` usa o esquema de CS, e o de `comercial` usa o de vendas;
  - uma conversa com avaliação `pronto` ontem não é reenviada;
  - com o limite de US$ 1, o gasto de US$ 0,90 e um resumo pendente estimado em US$ 0,08, nenhuma avaliação cabe: todas ficam `falhou` com `ERRO_LIMITE_MENSAL` e `motivo: "nada_a_fazer"`;
  - vendas entram antes de CS quando a verba só cabe uma;
  - a venda com telefone `+55 (11) 99999-8888` casa com o contato `551199998888`, sem o 9. Uma venda excluída, ou de 120 dias atrás, não casa;
  - uma segunda execução no mesmo dia devolve `ja_existe`;
  - a recusa 4xx apaga a reserva e marca `falhou`. O tempo esgotado mantém a reserva e as pendentes;
  - o cron `ia-whatsapp` roda as avaliações mesmo quando `criarLoteDoDia` lança erro.
- [ ] **Step 2:** Rode `npx vitest run src/modulos/whatsapp/servicos/lote-avaliacao.test.ts`. Esperado: FALHA.
- [ ] **Step 3:** Implemente. Depois rode também `lote-ia.test.ts`. Ele precisa continuar passando sem mudar nenhum teste, só imports.
- [ ] **Step 4:** Rode `npx vitest run src/modulos/whatsapp`. Esperado: PASSA.
- [ ] **Step 5:** Commit `feat(whatsapp): lote diário de avaliações das conversas`.

### Task 4: Coletar as avaliações

**Files:**
- Modify: `src/modulos/whatsapp/servicos/lote-ia.ts`. `coletarLotes` passa a pegar os lotes abertos dos dois tipos, e o item vai para o gravador do tipo do lote.
- Modify: `src/modulos/whatsapp/servicos/lote-avaliacao.ts` (gravador) e `lote-avaliacao.test.ts`

**Interfaces:**
- Produces: `gravarItemAvaliacao(item: ResultadoLote, loteId: string): Promise<"pronto" | "falhou" | null>`. As regras são as mesmas do gravador de resumo:
  - só quem tira a avaliação de `pendente` registra o uso;
  - o uso usa `lote: true`, com o modelo vindo de `AvaliacaoConversa.modelo`;
  - recusa, `max_tokens` e formato inválido dão `falhou`, com as mesmas mensagens de erro.
  
  Quando o item é válido:
  - o zod é escolhido pelo `tipoDoTime(time)` gravado;
  - `criterios` é a lista na ordem de `CRITERIOS[tipo]`, mais `CRITERIO_TEMPO` com `notaTempo`;
  - `notaGeralDecimos` sai da função `notaGeralDecimos` sobre todas essas notas;
  - se há `vendaId`, `situacaoLead = "fechou"`;
  - em CS, `situacaoLead`, `temperatura` e `motivoTemperatura` ficam `null`.
- `coletarLotes` devolve os totais dos dois tipos somados, com o mesmo formato de hoje.

- [ ] **Step 1: Testes que falham:**
  - um item `succeeded` de vendas, com `qualificacao` 8, `quebra_objecao` não se aplica, `followup` 6, `clareza_cordialidade` 9, `conducao_fechamento` 7 e `notaTempo` 10, grava `notaGeralDecimos` 80 e `situacao: "pronto"`;
  - com `vendaId`, grava `situacaoLead: "fechou"` mesmo quando a IA disse `negociando`;
  - um item de CS grava `temperatura: null`;
  - coletar duas vezes o mesmo lote registra o uso uma vez só;
  - um lote de resumo e um de avaliação abertos são coletados na mesma execução, e cada item vai para a tabela certa;
  - `stop_reason: "max_tokens"` grava `falhou` com `ERRO_GRANDE_DEMAIS` e registra o uso.
- [ ] **Step 2:** Rode o teste. Esperado: FALHA.
- [ ] **Step 3:** Implemente sem mudar o comportamento dos resumos. Os testes de `lote-ia.test.ts` que hoje filtram `where: { tipo: "resumo_grupo", situacao: "aberto" }` vão precisar aceitar o novo filtro. Ajuste só esse filtro no teste.
- [ ] **Step 4:** Rode `npx vitest run src/modulos/whatsapp`. Esperado: PASSA.
- [ ] **Step 5:** Commit `feat(whatsapp): coleta das avaliações das conversas`.

### Task 5: Aba Leads

**Files:**
- Create: `src/modulos/whatsapp/servicos/leads.ts` e `leads.test.ts`
- Create: `src/modulos/whatsapp/componentes/lista-leads.tsx` e `avaliacao-conversa.tsx` (o cartão de uma avaliação, reusado na Task 6)
- Create: `src/app/(app)/whatsapp/leads/page.tsx`
- Modify: `src/modulos/whatsapp/componentes/abas-whatsapp.tsx` e o teste dele. A ordem passa a ser Grupos, Atendimento, Leads, CS, Conversas, Números. Leads usa `whatsapp:ver_equipe`.

**Interfaces:**
- Produces:
  - `listarLeads(ator, dia: Date, filtros: { temperatura?: TemperaturaLead; situacao?: SituacaoLead; numeroId?: string }): Promise<{ itens: ItemLead[]; semVerba: number; falhas: number; pendentes: number }>`. Lança `ErroPermissao` sem `whatsapp:ver_equipe`. Os itens são as avaliações `pronto` do dia de tipo vendas (time `paciente_modelo` ou `comercial`). A ordem é quente, morno, frio, e depois a nota geral, da menor para a maior;
  - `ItemLead` traz `avaliacaoId`, `conversaId`, `contatoNome` (o `nomeExibido`, depois o nome da conversa, depois "Sem nome"), `numeroNome`, `situacaoLead`, `temperatura`, `motivoTemperatura`, `oQueRespondeu`, `proximoPasso`, `notaGeralDecimos`, `criterios` e `venda: { produto, criadoEm } | null`;
  - `ROTULO_SITUACAO_LEAD` e `ROTULO_TEMPERATURA`, em `regras/avaliacao.ts`.
- A página `/whatsapp/leads?dia=AAAA-MM-DD&temperatura=&situacao=&numero=`:
  - lê o dia com `diaDaConsulta`, e o padrão é ontem;
  - tem setas de dia anterior e próximo, nunca depois de ontem;
  - os filtros são links ou um `<form method="get">`, sem estado no cliente;
  - quando `semVerba > 0`, mostra o aviso "N conversas ficaram sem avaliação porque o limite mensal de IA do WhatsApp foi atingido.";
  - quando `pendentes > 0`, mostra "Avaliações de ontem ainda em processamento.";
  - cada lead é um cartão com ícone e cor por temperatura (quente vermelho, morno âmbar, frio azul), com texto além da cor;
  - o cartão mostra a situação, a frase do motivo, o que respondeu, o próximo passo, a nota geral, os critérios num `<details>` (com "não se aplica" quando a nota é null) e um link "Abrir conversa".

- [ ] **Step 1: Testes que falham** (`leads.test.ts`):
  - um gestor recebe as avaliações de vendas do dia, quentes primeiro, e as avaliações de CS ficam fora;
  - o filtro `temperatura: "frio"` traz só as frias;
  - um vendedor recebe `ErroPermissao`;
  - `semVerba` conta as avaliações `falhou` com `ERRO_LIMITE_MENSAL` no dia, e `pendentes` conta as `pendente`;
  - `abasDoPapel("admin")` traz Leads entre Atendimento e CS.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3:** Implemente o serviço, os componentes e a página. Siga o visual de `cs/page.tsx` e de `tabela-cs.tsx`, com as peças de `src/componentes/`.
- [ ] **Step 4:** Rode os testes. Esperado: PASSA. Depois rode `npx next typegen && npx tsc --noEmit` com o `DATABASE_URL` fictício. Esperado: sem erros.
- [ ] **Step 5:** Commit `feat(whatsapp): aba Leads com as avaliações da IA`.

### Task 6: Nota na aba Atendimento e na conversa

**Files:**
- Modify: `src/modulos/whatsapp/servicos/painel-atendimento.ts` e o teste dele
- Modify: `src/modulos/whatsapp/componentes/tabela-atendimento.tsx` e `grafico-atendimento.tsx`
- Modify: `src/app/(app)/whatsapp/atendimento/page.tsx`
- Modify: `src/app/(app)/whatsapp/conversas/[id]/page.tsx`, `src/modulos/whatsapp/servicos/conversas.ts` e o teste dele

**Interfaces:**
- `LinhaAtendimento` ganha `notaDecimos: number | null`, e `PontoEvolucao` ganha `nota: number | null` (de 0 a 10, com uma casa).
  - A nota da semana é a média de `notaGeralDecimos` da avaliação `pronto` mais recente de cada conversa na semana, uma por conversa. As avaliações entram pelo `numeroId` e pelo `dia` da semana.
- `pioresNotas(ator, numeroId: string, semana: Semana, limite = 5): Promise<{ conversaId; contatoNome; dia; notaGeralDecimos; melhorar }[]>` traz as notas mais baixas, uma por conversa.
- `ultimaAvaliacao(ator, conversaId): Promise<ItemLead-like | null>` só funciona com `whatsapp:ver_equipe`. Para quem não tem a permissão, devolve `null` sem lançar erro, porque o vendedor também abre a conversa.
- Telas:
  - a tabela ganha a coluna "Nota IA";
  - o gráfico ganha a linha "Nota IA" num eixo de 0 a 10;
  - com um número selecionado, aparece o card "Piores notas da semana", com o link para a conversa;
  - a página da conversa mostra o cartão `avaliacao-conversa.tsx` acima das mensagens, só para a gestão.

- [ ] **Step 1: Testes que falham:**
  - `resumoDaSemana` com duas avaliações da mesma conversa na semana (nota 4,0 na segunda e 8,0 na quarta) e uma de outra conversa (6,0) dá `notaDecimos` 70;
  - `pioresNotas` traz no máximo uma linha por conversa, da menor nota para a maior;
  - `ultimaAvaliacao` para um vendedor devolve `null` e não consulta avaliações.
- [ ] **Step 2:** Rode. Esperado: FALHA.
- [ ] **Step 3:** Implemente. O texto do `CardDescription` da semana ganha: "Nota IA: média da avaliação mais recente de cada conversa na semana."
- [ ] **Step 4:** Rode `npx vitest run src/modulos/whatsapp`, depois `npx next typegen && npx tsc --noEmit`. Esperado: PASSA, sem erros.
- [ ] **Step 5:** Commit `feat(whatsapp): nota da IA no atendimento e na conversa`.

### Task 7: Documentação

**Files:**
- Modify: `docs/modulos/whatsapp.md`, com a seção da entrega 5, a linha do objetivo e a nota de que o modelo da avaliação é o Sonnet, com o motivo.
- Modify: `docs/runbooks/whatsapp-motor-vps.md` §18. Os mesmos crons `ia-whatsapp` e `coletar-ia-whatsapp` agora fazem resumos e avaliações. Não há cron novo.
- Modify: `docs/lgpd/whatsapp-textos.md`, linha da Anthropic: "para gerar resumos e avaliações das conversas". Tire "Esse recurso entra em uma etapa futura".

- [ ] **Step 1:** Escreva os três textos.
- [ ] **Step 2:** Rode `npx vitest run` com a suíte inteira. Esperado: PASSA.
- [ ] **Step 3:** Commit `docs(whatsapp): entrega 5 no módulo, runbook e texto de privacidade`.

## Depois do envio (com o Gustavo)

1. Nenhum cron novo. Na madrugada seguinte, o `ia-whatsapp` das 4h30 já cria os dois lotes.
2. De manhã, conferir `/admin/saude` (o gasto do mês) e a aba Leads de ontem.
3. O Gustavo lê 3 avaliações e diz se a temperatura e as notas fazem sentido. Ajustes de texto do prompt são baratos.
4. Avisar que a política de privacidade publicada precisa do texto novo da Anthropic.
