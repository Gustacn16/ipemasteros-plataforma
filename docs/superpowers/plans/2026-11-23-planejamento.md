# Planejamento e metas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a área `/planejamento`: plano anual com turmas → meta de vendas → funil, indicadores de Comercial e Marketing com realizado automático ou lançado, metas congeladas ao fechar o mês e um Painel "estamos no caminho?".

**Architecture:** Novo módulo `src/modulos/planejamento` no padrão dos outros (regras puras testadas, esquemas zod, serviços `server-only`, ações `"use server"`, componentes). Os cálculos (distribuição das turmas, funil, desempenho, acumulado) são funções puras em `regras/`. Os serviços leem o banco, congelam meses fechados em `FechamentoMesPlano` e montam as telas. As vendas, os leads e a mídia são lidos das tabelas do Comercial; Instagram e conteúdos, das tabelas do Conteúdo.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 + MySQL (migration SQL escrita à mão, como as anteriores), zod, Vitest, Tailwind v4, shadcn, Recharts.

**Spec:** `docs/superpowers/specs/2026-11-23-planejamento-design.md`

## Global Constraints
- Mês sempre como texto `AAAA-MM` entre camadas; no banco, coluna `@db.Date` com o dia 1 (`new Date("AAAA-MM-01T00:00:00Z")`).
- Dinheiro: `Decimal(12,2)` no banco, centavos (inteiro) nas regras, string `"3300.00"` para a tela (`src/lib/dinheiro.ts`).
- Valores de indicador e percentuais: `Decimal(18,4)`. Percentual guardado como fração (0.2 = 20%).
- Desempenho: ✔ `ok` ≥ 100%, ⚠ `atencao` 80–99%, ✖ `ruim` < 80%. Meta nula ou zero → `null` ("—").
- "Mês fechado" = mês anterior ao mês atual em São Paulo (`diaEmSaoPaulo` de `src/modulos/tarefas/regras/prazo`).
- Texto de tela e mensagens em português simples. Commits em Conventional Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Auditoria só com ids e nomes de campos, nunca dados pessoais.
- Não editar `CLAUDE.md`.

## Review Focus
1. **Plano sem turmas ou sem premissas** (ano recém-criado): todas as telas abrem com estado vazio e "—", sem erro de divisão por zero. *Teste:* `calcularFunil` com 0 alunos devolve zeros e `cacPorAluno: null` (Task 2); `desempenho` com meta 0 → `null` (Task 3).
2. **Turma cuja janela começa no ano anterior** (T5 jan/27 com janela 5 → set/26 a jan/27): só jan/27 entra no ano; set–dez/26 vão para "antes do período". *Teste:* em Task 2.
3. **Premissa do funil zerada** (conversão 0%): sem `Infinity` na tela. *Teste:* `calcularFunil` com `convReuniaoVenda: 0` → contagens `null` (Task 2).
4. **Mudar turma depois de um mês fechar** não muda a meta daquele mês. *Teste:* `metaDoMes` usa o retrato quando ele existe (Task 5, regra pura `escolherMetaDoMes`).
5. **Lançar realizado de mês futuro ou em indicador automático** é recusado com mensagem clara. *Teste:* `validarLancamento` (Task 7).

---

### Task 1: Banco, permissões e menu

**Files:**
- Modify: `prisma/schema.prisma` (seção nova "Planejamento" no fim; relações inversas em `Usuario` e `Produto`)
- Create: `prisma/migrations/20261123100000_planejamento/migration.sql`
- Modify: `src/lib/permissoes.ts`, `src/lib/auditoria.ts` (tipo `AcaoAuditoria`)
- Modify: `src/app/(app)/layout.tsx`, `src/app/(app)/menu-navegacao.tsx` (ícone `planejamento: <GoalIcon />`)

**Interfaces:**
- Produces: modelos Prisma `PlanoAnual`, `PremissaProdutoPlano`, `TurmaPlano`, `MetaAvulsaPlano`, `FechamentoMesPlano`, `IndicadorPlano`, `MetaMensalIndicador`, `RealizadoMensalIndicador`; enums `FrenteIndicador {comercial marketing}`, `UnidadeIndicador {numero reais percentual}`, `TipoIndicador {fluxo estoque taxa}` (o `sentido` reusa `SentidoIndicador`); permissões `planejamento:ver`, `planejamento:editar`, `planejamento:lancar`; ações de auditoria `planejamento.plano_criado`, `planejamento.turma_excluida`, `planejamento.indicador_excluido`, `planejamento.realizado_lancado`.

Campos (nomes de coluna em snake_case via `@map`, tabelas no plural como as outras):
- `PlanoAnual`: id, ano Int @unique, observacoes Text?, convLeadAgendada, comparecimento, convReuniaoVenda (Decimal 18,4), custoPorLead (Decimal 12,2), comissaoPct, tetoCacPct (Decimal 18,4), criadoPorId, criadoEm, atualizadoEm.
- `PremissaProdutoPlano`: id, planoId, produtoId, contratoMedio Decimal(12,2), alunosPorTurma Int, janelaVendasMeses Int, duracaoMeses Int; `@@unique([planoId, produtoId])`; cascade no plano.
- `TurmaPlano`: id, planoId, produtoId, codigo VarChar(20), mesAbertura Date, alunos Int?, contratoMedio Decimal?, janelaVendasMeses Int?, duracaoMeses Int?, observacoes VarChar(300)?, excluidoEm, criadoEm, atualizadoEm; índice (planoId).
- `MetaAvulsaPlano`: id, planoId, produtoId, mes Date, alunos Int, valor Decimal(12,2); `@@unique([planoId, produtoId, mes])`.
- `FechamentoMesPlano`: id, planoId, mes Date, dados Json, criadoEm; `@@unique([planoId, mes])`.
- `IndicadorPlano`: id, planoId, frente, grupo VarChar(60), nome VarChar(120), unidade, sentido, tipo, metaCalculada VarChar(40)?, fonte VarChar(40) default "manual", fonteParametros Json?, responsavelId?, noPainel Boolean default true, ordem Int, excluidoEm, criadoEm, atualizadoEm.
- `MetaMensalIndicador`: id, indicadorId, mes Date, valor Decimal(18,4); `@@unique([indicadorId, mes])`; cascade.
- `RealizadoMensalIndicador`: id, indicadorId, mes Date, valor Decimal(18,4), observacao VarChar(300)?, registradoPorId, criadoEm, atualizadoEm; `@@unique([indicadorId, mes])`; cascade.

Permissões: `PLANEJAMENTO_GESTAO = ["planejamento:ver","planejamento:editar","planejamento:lancar"]` para admin e gestor; `planejamento:lancar` também em `PERMISSOES_COLABORADOR` (e, portanto, no comercial), porque a regra por registro (ser responsável) fica no serviço.

Menu: item "Planejamento" (`/planejamento`, depois de Comercial) quando `planejamento:ver`, ou quando `ehResponsavelNoPlanejamento(usuario.id)` (Task 7) devolve true (com `.catch(() => false)`); nesse caso o link vai para `/planejamento/lancar`.

- [ ] **Step 1:** Escrever os modelos no schema e a migration SQL no mesmo estilo de `20261119120000_processos_internos` (CREATE TABLE com `utf8mb4_unicode_ci`, índices e FKs).
- [ ] **Step 2:** Rodar `npx prisma validate` e `npx prisma generate` → sem erro.
- [ ] **Step 3:** Permissões, auditoria e menu. Rodar `npm run typecheck` (com as variáveis falsas do README) → sem erro.
- [ ] **Step 4:** Commit `feat(planejamento): tabelas, permissões e menu`.

### Task 2: Regras do plano comercial (turmas e funil)

**Files:**
- Create: `src/modulos/planejamento/regras/meses.ts`, `regras/turmas.ts`, `regras/funil.ts`
- Test: `regras/turmas.test.ts`, `regras/funil.test.ts`

**Interfaces:**
- Produces:
  - `meses.ts`: `mesesDoAno(ano: number): string[]` (12 meses `AAAA-MM`); `somarMeses(mes: string, n: number): string`; `mesFechado(mes: string, hoje: string): boolean`; `mesComecou(mes: string, hoje: string): boolean`. Reusar `primeiroDiaDoMes`, `mesSeguinte` e `rotuloMes` de `@/modulos/comercial/regras/meta` quando servirem.
  - `turmas.ts`:
    - `type Premissa = { produtoId: string; contratoCentavos: number; alunosPorTurma: number; janelaVendasMeses: number; duracaoMeses: number }`
    - `type Turma = { id: string; produtoId: string; codigo: string; mesAbertura: string; alunos: number | null; contratoCentavos: number | null; janelaVendasMeses: number | null; duracaoMeses: number | null }`
    - `type MetaAvulsa = { produtoId: string; mes: string; alunos: number; valorCentavos: number }`
    - `type MetaProdutoMes = { alunos: number; valorCentavos: number }`
    - `turmaEfetiva(t: Turma, p: Premissa | undefined): { alunos; contratoCentavos; janela; duracao }` (vazio usa a premissa; sem premissa e sem valor → 0, janela mínima 1)
    - `distribuirTurma(t, p): { mes: string; alunos: number; valorCentavos: number }[]` — a janela termina no mês de abertura; base = ⌊alunos ÷ janela⌋ e a sobra vai, 1 a cada, para os **últimos** meses.
    - `metasDeVendas(ano, premissas, turmas, avulsas): { porMes: Record<mes, Record<produtoId, MetaProdutoMes>>; antes: Record<produtoId, MetaProdutoMes>; depois: Record<produtoId, MetaProdutoMes> }`
  - `funil.ts`:
    - `type PremissasFunil = { convLeadAgendada: number; comparecimento: number; convReuniaoVenda: number; custoPorLeadCentavos: number; comissaoPct: number; tetoCacPct: number }`
    - `type FunilMes = { alunos: number; valorCentavos: number; reunioesRealizadas: number | null; reunioesAgendadas: number | null; leads: number | null; verbaCentavos: number | null; comissaoCentavos: number; cacTotalCentavos: number | null; cacPorAlunoCentavos: number | null; cacPct: number | null; acimaDoTeto: boolean }`
    - `calcularFunil(meta: MetaProdutoMes, p: PremissasFunil): FunilMes`. Cada contagem arredonda para cima, usando a anterior já arredondada. Divisor 0 → `null` na contagem e no que depende dela.
    - `conversaoGeral(p): number` (produto das 3 conversões).

- [ ] **Step 1: Testes que falham** (`turmas.test.ts`):
  - `distribuirTurma` com 15 alunos, janela 4, abertura `2027-05`, contrato 7.500.000 centavos → `[{2027-02,3},{2027-03,4},{2027-04,4},{2027-05,4}]`, valor do mês = alunos × 7.500.000.
  - Turma com campos vazios herda a premissa (alunosPorTurma 10, janela 6).
  - `metasDeVendas(2027, …)` com T5 (`2027-01`, janela 5, 15 alunos) → `porMes["2027-01"][p].alunos === 3` e `antes[p].alunos === 12`.
  - Turma `2028-01`, janela 4, 15 alunos (3, 4, 4, 4 em out, nov, dez/27 e jan/28) → `porMes["2027-10"][p].alunos === 3`, `["2027-11"] === 4`, `["2027-12"] === 4` e `depois[p].alunos === 4`.
  - Meta avulsa soma com a da turma no mesmo produto e mês.
- [ ] **Step 2:** `funil.test.ts`, com as premissas da planilha (0.2, 0.75, 0.25, 15.000 centavos, 0.05, 0.10):
  - 7 alunos e R$ 295.000 → reuniões realizadas 28, agendadas 38, leads 190, verba 2.850.000, comissão 1.475.000, CAC total 4.325.000, CAC por aluno 617.857 (arredondado ao centavo), CAC % ≈ 0.1466, `acimaDoTeto: true`.
  - `conversaoGeral` = 0.0375.
  - 0 alunos → contagens 0, `cacPorAlunoCentavos: null`, `cacPct: null`.
  - `convReuniaoVenda: 0` com 7 alunos → `reunioesRealizadas`, `reunioesAgendadas`, `leads` e `verbaCentavos` `null`.
- [ ] **Step 3:** Rodar `npx vitest run src/modulos/planejamento` → FAIL (módulos não existem).
- [ ] **Step 4:** Implementar `meses.ts`, `turmas.ts` e `funil.ts`.
- [ ] **Step 5:** Rodar de novo → PASS. Commit `feat(planejamento): regras de turmas e funil`.

### Task 3: Regras de desempenho, acumulado e catálogo de indicadores

**Files:**
- Create: `regras/desempenho.ts`, `regras/indicadores-padrao.ts`, `regras/fontes.ts`
- Test: `regras/desempenho.test.ts`, `regras/indicadores-padrao.test.ts`

**Interfaces:**
- Produces:
  - `type Status = "ok" | "atencao" | "ruim"`; `type Sentido = "maior_melhor" | "menor_melhor"`; `type Tipo = "fluxo" | "estoque" | "taxa"`
  - `desempenho(realizado: number | null, meta: number | null, sentido: Sentido): number | null`
  - `statusDe(pct: number | null): Status | null` (1 → ok, 0.8 → atencao, 0.79 → ruim)
  - `acumular(tipo: Tipo, meses: { mes: string; meta: number | null; realizado: number | null }[]): { meta: number | null; realizado: number | null }`. Recebe só os meses que já começaram. fluxo: soma (meta nula conta 0; realizado `null` se nenhum mês tem dado). estoque: realizado do último mês com dado e a meta desse mesmo mês. taxa: média dos meses com dado, separadamente para meta e realizado.
  - `fontes.ts`: `CHAVES_META_CALCULADA = ["vendas_valor","vendas_alunos","leads","reunioes_agendadas","reunioes_realizadas","investimento_midia","cac_por_aluno","conversao_lead_venda"] as const`; `FONTES = ["manual","vendas_valor","vendas_alunos","meta_leads","meta_investimento","instagram_seguidores","instagram_alcance","conteudos_publicados","calc_cac","calc_conversao"] as const`; `ROTULO_FONTE: Record<Fonte,string>`; `fonteAutomatica(f: Fonte): boolean`; `esquemaParametrosFonte` (zod: `{ contaId? , canalId?, formatoId? }`), com `contaId` obrigatório nas fontes do Instagram e `canalId` em `conteudos_publicados`.
  - `indicadores-padrao.ts`: `INDICADORES_PADRAO: IndicadorPadrao[]` com as 8 linhas Comercial e as 13 de Marketing da spec, na ordem da spec. `IndicadorPadrao = { frente; grupo; nome; unidade; sentido; tipo; metaCalculada: ChaveMetaCalculada | null; fonte: Fonte; metaMensalInicial: number | null }`. Metas iniciais: posts 20, reels 12, YouTube 4, newsletter 4 edições, taxa de abertura 0.35, podcast 4 episódios, eventos 1. Os indicadores Instagram e conteúdos nascem com `fonte: "manual"`, porque os parâmetros (conta, canal) são escolhidos na tela (a spec diz "automático se a conta estiver conectada"; o serviço da Task 6 liga a fonte quando acha a conta). `PREMISSAS_FUNIL_PADRAO`: 0.2, 0.75, 0.25, 15.000 centavos, 0.05, 0.10.
- [ ] **Step 1: Testes que falham:**
  - `desempenho(190, 190, "maior_melhor") === 1`; `desempenho(6000, 6179, "menor_melhor") ≈ 1.0298`; `desempenho(5, 0, …) === null`; `desempenho(null, 10, …) === null`; `desempenho(0, 6179, "menor_melhor") === null`.
  - `statusDe(1)="ok"`, `statusDe(0.8)="atencao"`, `statusDe(0.7999)="ruim"`, `statusDe(null)=null`.
  - `acumular("fluxo", [{meta 10, real 8},{meta 10, real null}])` → `{meta: 20, realizado: 8}`; `acumular("estoque", [{meta 1000, real 900},{meta 1100, real null}])` → `{meta: 1000, realizado: 900}`; `acumular("taxa", [{0.35, 0.30},{0.35, 0.40}])` → `{0.35, 0.35}`.
  - `INDICADORES_PADRAO` tem 21 itens, 8 com frente comercial, e todo `metaCalculada` é uma chave válida.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit `feat(planejamento): desempenho, acumulado e indicadores padrão`.

### Task 4: Esquemas zod

**Files:**
- Create: `src/modulos/planejamento/esquemas/planejamento.ts`
- Test: `esquemas/planejamento.test.ts`

**Interfaces:**
- Produces: `esquemaAno` (2020–2100), `esquemaMesPlano` (regex `AAAA-MM`), `esquemaPremissasFunil` (percentuais digitados como "20" ou "20,5" → fração 0–1; custo por lead em reais via `lerReais`), `esquemaPremissaProduto`, `esquemaTurma` (codigo 1–20 chars, campos opcionais vazios → `null`, alunos 1–500, janela 1–24, duração 1–60), `esquemaMetaAvulsa`, `esquemaIndicador` (nome 1–120, grupo 0–60, enums, fonte + parâmetros validados por `esquemaParametrosFonte`), `esquemaMetasIndicador` (`{ indicadorId, valores: Record<AAAA-MM, string> }`; vazio apaga), `esquemaLancamento` (`{ indicadorId, mes, valor, observacao? ≤300 }`). Tipos `Dados…` exportados com `z.infer`.
- [ ] **Step 1:** Testes: "20" → 0.2; "120" em percentual → erro "Use um valor entre 0 e 100."; turma com `alunos: ""` → `null`; `esquemaMesPlano` recusa "2027-13".
- [ ] **Step 2:** FAIL → implementar → PASS. Commit `feat(planejamento): validações dos formulários`.

### Task 5: Serviços do plano (criar, premissas, turmas, metas avulsas, congelamento)

**Files:**
- Create: `servicos/acesso.ts`, `servicos/planos.ts`, `servicos/fechamento.ts`, `regras/fechamento.ts`
- Test: `regras/fechamento.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `acesso.ts`: `exigir(ator, permissao)`, `podeEditar(ator)`, `podeLancar(ator, responsavelId)` (igual a `processos/servicos/acesso.ts`).
  - `regras/fechamento.ts`: `type RetratoMes = { produtos: Record<produtoId, MetaProdutoMes>; funil: FunilMes }`; `retratarMes(mes, metas, premissasFunil): RetratoMes`; `escolherMetaDoMes(mes, hoje, retratos: Record<mes, RetratoMes>, calculado: RetratoMes): RetratoMes` (mês fechado com retrato → retrato; senão, calculado); `mesesParaCongelar(ano, hoje, jaCongelados: string[]): string[]`.
  - `fechamento.ts`: `carregarPlanoCalculado(planoId: string, hoje: string): Promise<PlanoCalculado>` com `{ plano, premissasFunil, porMes: Record<mes, RetratoMes>, antes, depois, congelados: string[] }` (já aplicando os retratos); `congelarMesesFechados(planoId, hoje, tx?)` (grava com `createMany({ skipDuplicates: true })`).
  - `planos.ts`: `listarAnos(ator): Promise<number[]>`; `obterPlano(ator, ano)`; `criarPlano(ator, ano)` (cria plano com `PREMISSAS_FUNIL_PADRAO` e os `INDICADORES_PADRAO` com metas mensais iniciais; auditoria `planejamento.plano_criado`); `salvarPremissasFunil`, `salvarPremissaProduto`, `removerPremissaProduto`, `salvarTurma` (cria ou edita), `excluirTurma` (lógico, auditoria), `salvarMetaAvulsa` (vazio apaga). **Toda** mudança chama `congelarMesesFechados` na mesma transação, antes de gravar. Plano duplicado → `ErroNegocio("Já existe um plano para 2027.")`.
- [ ] **Step 1:** Testes de `regras/fechamento.ts`: `escolherMetaDoMes("2027-01", "2027-03-10", {"2027-01": retratoA}, calculadoB) === retratoA`; mês atual ignora o retrato; `mesesParaCongelar(2027, "2027-03-10", ["2027-01"])` → `["2027-02"]`; em 2026 (antes do plano) → `[]`.
- [ ] **Step 2:** FAIL → implementar as regras → PASS.
- [ ] **Step 3:** Implementar os serviços. Rodar `npm run typecheck` → sem erro.
- [ ] **Step 4:** Commit `feat(planejamento): serviços do plano e congelamento dos meses fechados`.

### Task 6: Realizado automático e indicadores

**Files:**
- Create: `servicos/realizado.ts`, `servicos/indicadores.ts`

**Interfaces:**
- Consumes: `carregarPlanoCalculado` (Task 5), `FONTES` (Task 3), `totalLeads` de `@/modulos/comercial/regras/midia`.
- Produces:
  - `realizado.ts`: `realizadoAutomatico(plano: { id; ano; comissaoPct; produtosDoPlano: string[] }, indicadores: { id; fonte; fonteParametros }[], ate: string): Promise<Record<indicadorId, Record<mes, number | null>>>`. Uma consulta por fonte para o ano todo:
    - `vendas_valor` / `vendas_alunos`: `Venda` com `excluidoEm: null`, `produtoId in produtosDoPlano`, por `dataVenda` (reais e contagem);
    - `meta_leads` / `meta_investimento`: `MetricaDiariaAnuncio` de contas `ativa: true, moeda: "BRL"` (mesmo filtro da projeção);
    - `instagram_seguidores`: `MetricaContaInstagram` da conta, `periodo: "dia"`, último dia do mês com `seguidores`;
    - `instagram_alcance`: linha `periodo: "mes"` com `data` = dia 1; sem linha → `null`;
    - `conteudos_publicados`: `Publicacao` `status: "publicado"`, `canalId`, `publicadoEm` no mês e, se houver `formatoId`, `conteudo.formatoId`;
    - `calc_conversao` = alunos ÷ leads; `calc_cac` = (investimento + valor × comissaoPct) ÷ alunos (alunos 0 → `null`).
    - Meses que ainda não começaram → `null`.
  - `indicadores.ts`: `listarIndicadores(ator, planoId)`; `criarIndicador`, `editarIndicador`, `moverIndicador(ator, id, "subir"|"descer")`, `excluirIndicador` (recusa quando `metaCalculada` existe: "Este indicador vem do plano; esconda do Painel em vez de excluir."), `salvarMetasIndicador(ator, dados)` (recusa meses fechados: "A meta de um mês fechado não muda." e indicadores com `metaCalculada`), `listarOpcoesDeFonte()` (contas do Instagram ativas, canais e formatos ativos).
  - Em `criarPlano` (Task 5), ligar `instagram_seguidores`/`instagram_alcance` à conta cujo `usuario` contém "ipemaster" ou "pedro" (sem acento e sem caixa), quando houver; senão, ficam manuais.
- [ ] **Step 1:** Implementar. Rodar `npm run typecheck` e `npx vitest run src/modulos/planejamento` → sem erro e PASS.
- [ ] **Step 2:** Commit `feat(planejamento): realizado automático e cadastro de indicadores`.

### Task 7: Lançamento de resultados

**Files:**
- Create: `regras/lancamento.ts`, `servicos/lancamento.ts`
- Test: `regras/lancamento.test.ts`

**Interfaces:**
- Produces: `validarLancamento({ mes, hoje, fonte }): string | null` (mensagem de erro ou `null`): mês futuro → "Não dá para lançar um mês que ainda não começou."; fonte automática → "Este número vem sozinho da plataforma."; `listarParaLancar(ator, ano, mes)` (só indicadores manuais; sem `planejamento:lancar` de gestão, só os da pessoa); `lancarResultado(ator, dados)` (upsert; valor vazio apaga; auditoria `planejamento.realizado_lancado`); `ehResponsavelNoPlanejamento(usuarioId): Promise<boolean>`.
- [ ] **Step 1:** Testes: mês `2027-04` com hoje `2027-03-31` → erro de mês futuro; mês atual com fonte `manual` → `null`; fonte `meta_leads` → erro de fonte automática.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit `feat(planejamento): lançamento dos resultados do mês`.

### Task 8: Painel e visões (serviço)

**Files:**
- Create: `servicos/visoes.ts`

**Interfaces:**
- Produces:
  - `obterLinhasIndicadores(ator, ano, mes)`: para cada indicador, 12 meses `{ mes, meta, realizado, pct, status, parcial }`, mais `mesEscolhido` e `acumulado` (`{ meta, realizado, pct, status }`). Meta calculada vem de `PlanoCalculado.porMes[mes].funil` (vendas_valor → valor em reais, vendas_alunos → alunos, leads, reuniões, investimento → verba, cac_por_aluno, conversao_lead_venda → `conversaoGeral`). CAC e conversão acumulados são recalculados a partir dos componentes acumulados (soma de vendas, leads, investimento), não pela média.
  - `obterPainel(ator, ano, mes)`: `{ statusGeral: { noCaminho, comDado }, linhas (só noPainel), graficoVendas: {mes, meta, realizado}[], graficoLeads }`.
  - `obterPlanoComercial(ator, ano, mes)`: metas por produto e mês com antes/depois, funil por mês, linhas Comercial.
  - `obterPlanoMarketing(ator, ano)`: linhas Marketing agrupadas por `grupo`, mais "% dos indicadores batidos" por mês.
  - `obterPlanoDoMesParaMetas(ator, mes): Promise<Record<produtoId, MetaProdutoMes> | null>` (para o Comercial; exige `comercial:gerenciar_metas`).
- [ ] **Step 1:** Implementar. `npm run typecheck` → sem erro. Commit `feat(planejamento): dados do painel e das visões`.

### Task 9: Ações e telas de cadastro

**Files:**
- Create: `acoes/planejamento.ts`, `componentes/abas-planejamento.tsx`, `componentes/seletor-ano-mes.tsx`, `componentes/form-premissas.tsx`, `componentes/turmas.tsx`, `componentes/metas-avulsas.tsx`, `componentes/indicadores-cadastro.tsx`, `componentes/lancar.tsx`
- Create: `src/app/(app)/planejamento/layout.tsx`, `cadastro/page.tsx` (redireciona para `cadastro/premissas`), `cadastro/premissas/page.tsx`, `cadastro/turmas/page.tsx`, `cadastro/indicadores/page.tsx`, `lancar/page.tsx`

**Interfaces:**
- Consumes: serviços das Tasks 5–7.
- Produces: ações `criarPlanoAcao`, `salvarPremissasFunilAcao`, `salvarPremissaProdutoAcao`, `removerPremissaProdutoAcao`, `salvarTurmaAcao`, `excluirTurmaAcao`, `salvarMetaAvulsaAcao`, `salvarIndicadorAcao`, `moverIndicadorAcao`, `excluirIndicadorAcao`, `salvarMetasIndicadorAcao`, `lancarResultadoAcao`, no padrão `executar()` de `processos/acoes/processos.ts` (revalida `/planejamento`, `layout`).
- Abas: **Painel · Comercial · Marketing** | **Cadastrar · Lançar resultados**, com um separador visual entre "ver" e "cadastrar". Cadastrar só aparece com `planejamento:editar`; dentro dele, sub-abas Premissas · Turmas e metas avulsas · Indicadores e metas. Ano na URL (`?ano=`); sem plano no ano, mostrar estado vazio com "Criar plano de AAAA" para quem edita.
- Aviso fixo nas telas de cadastro: "Mudanças valem do mês atual em diante. Meses fechados ficam como estavam."
- Grade de metas: 12 campos por indicador, botão "Repetir em todos os meses" (preenche os meses abertos com o valor do primeiro mês aberto), meses fechados desabilitados.
- [ ] **Step 1:** Implementar. `npm run typecheck` e `npm run lint` → sem erro.
- [ ] **Step 2:** Commit `feat(planejamento): telas de cadastro e lançamento`.

### Task 10: Telas de visualização e ligação com as Metas do Comercial

**Files:**
- Create: `componentes/tabela-desempenho.tsx` (linha com ✔/⚠/✖, "parcial" no mês em andamento, "—"), `componentes/graficos-painel.tsx` (Recharts, barras de meta × realizado), `src/app/(app)/planejamento/page.tsx` (Painel), `comercial/page.tsx`, `marketing/page.tsx`
- Modify: `src/app/(app)/comercial/metas/cadastro/page.tsx`, `src/modulos/comercial/componentes/metas-mes.tsx` (prop opcional `plano?: Record<produtoId, { alunos: number; valorCentavos: number }> | null`)

**Interfaces:**
- Consumes: `obterPainel`, `obterPlanoComercial`, `obterPlanoMarketing`, `obterPlanoDoMesParaMetas` (Task 8).
- No cartão do produto em Metas: "Plano: N alunos · R$ X" e, comparando com a soma dos vendedores, "Faltam distribuir R$ Y" (âmbar), "R$ Y acima do plano" (âmbar) ou "Distribuído ✔" (verde). Sem plano no ano: nada aparece.
- Plano comercial: tabela "Meta de vendas" (linhas por produto, colunas antes, jan…dez, depois, total), tabela "O que precisa acontecer no mês" (funil; CAC % acima do teto em vermelho), tabela de desempenho Comercial.
- [ ] **Step 1:** Implementar. Abrir com `preview_start` (ou `npm run build` local com as variáveis falsas) → as rotas compilam.
- [ ] **Step 2:** `npm run typecheck`, `npm run lint`, `npm test` → tudo verde. Commit `feat(planejamento): painel, planos comercial e de marketing e aviso nas metas`.

### Task 11: Documentação

**Files:**
- Create: `docs/modulos/planejamento.md` (no formato de `docs/modulos/processos.md`: objetivo, entidades, regras, permissões, auditoria, telas, fora do escopo)
- Modify: `docs/01-visao-geral.md` (linha na tabela de módulos), `docs/03-modelo-de-dados.md` (tabelas novas), `docs/04-seguranca-permissoes.md` (seção Planejamento), `docs/modulos/comercial.md` (Metas: "a meta do produto vem do plano; a tela mostra quanto falta distribuir").
- [ ] **Step 1:** Escrever. Commit `docs(planejamento): módulo, modelo de dados e permissões`.

### Task 12: Verificação final e publicação no `teste`

- [ ] **Step 1:** No worktree: `npm test`, `npm run typecheck`, `npm run lint` e `DATABASE_URL="mysql://x:y@127.0.0.1:3306/fake" BETTER_AUTH_SECRET=x BETTER_AUTH_URL=http://localhost:3000 npx next build --webpack` (sem `migrate deploy`) → tudo passa.
- [ ] **Step 2:** Revisão do branch inteiro por um revisor novo (superpowers:requesting-code-review); corrigir o que for confirmado.
- [ ] **Step 3:** `git fetch`/atualizar `teste`, `git rebase teste` no branch `planejamento`, rodar os testes de novo; na pasta principal, `git merge --ff-only planejamento` em `teste` só se a pasta estiver em `teste` e sem conflito com mudanças de outras sessões; senão, `git push origin planejamento:teste` a partir do worktree depois de confirmar que é fast-forward. Nunca `main`.
- [ ] **Step 4:** Depois do deploy, abrir teste.plataformaipemaster.com.br/planejamento e conferir: criar plano 2027, cadastrar uma turma, ver a meta e o funil, lançar um resultado e ver o Painel.
