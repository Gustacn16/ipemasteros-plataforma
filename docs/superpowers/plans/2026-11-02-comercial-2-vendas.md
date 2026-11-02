# Comercial — Entrega 2 (Vendas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar vendas pelo formulário que a equipe já usa (preenchido pela oferta do produto), listar com filtros e total, editar e excluir com auditoria, respeitando o papel `comercial`.

**Architecture:** Segue o módulo `src/modulos/comercial/` da entrega 1: regras puras testadas em `regras/venda.ts`, esquema Zod em `esquemas/venda.ts`, serviço `servicos/vendas.ts` com checagem de permissão e regra por registro, ações em `acoes/vendas.ts`, tela `src/app/(app)/comercial/vendas/page.tsx`. Uma migration de estrutura.

**Tech Stack:** Next.js 16.4.3 (`--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, shadcn.

**Spec:** `docs/superpowers/specs/2026-11-02-comercial-design.md` (seções 4 `Venda`, 5.1–5.3, 5.5–5.8, 5.10–5.11, 6, 7 `/comercial/vendas`, 10.2). Plano anterior: `docs/superpowers/plans/2026-11-02-comercial-1-produtos.md`.

## Global Constraints

- Mesmas da entrega 1: português em tudo; Conventional Commits terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; commitar só os próprios arquivos com `git commit -m "..." -- <arquivos>`; nunca `git add -A`, stash, reset ou troca de branch; branch `teste`.
- Dinheiro em `Decimal(12,2)`, trafega como string `"1234.56"`. Contas de dinheiro em **centavos inteiros**, nunca em ponto flutuante.
- Datas sem hora (`dataVenda`, `dataEntradaLead`, `dataEntrega`, `primeiroVencimento`) em `@db.Date`, como "AAAA-MM-DD" do calendário de São Paulo; o Prisma devolve meia-noite UTC.
- Antes de mexer no `prisma/schema.prisma`, `git status --short prisma/` deve estar vazio; senão, parar e avisar. Migration gerada com `prisma migrate diff --from-schema <schema do HEAD> --to-schema prisma/schema.prisma --script`, com timestamp posterior à última pasta em `prisma/migrations/`.
- Nome e WhatsApp do cliente são dados pessoais: não entram no `diff` da auditoria (só nomes de campos e valor total), nunca em URL nem em log.
- Verificação: `npm run typecheck`, `npm run test`, `npx eslint <arquivos>`, `npx next build --webpack`; formatar com `npx prettier --print-width 140 --write <arquivos>`.

## Review Focus

1. Vendedor `comercial` forjando no formulário o `vendedorId` de outra pessoa → o servidor recusa — Task 1 (`vendedorPermitido`) e Task 3.
2. Editar ou excluir venda própria depois de 7 dias chamando a ação direto → recusado — Task 1 (`podeEditarVenda`) e Task 3.
3. Soma de parcelas com centavos (3 × R$ 333,33 + R$ 0,01) sem erro de arredondamento — Task 1 (`valorTotal` em centavos).
4. `ofertaId` de outro produto, ou produto/canal inativo enviados por formulário forjado → recusado; mas editar uma venda antiga cujo produto foi desativado depois continua permitido — Task 3.
5. Venda com valor total zero (tudo vazio) ou data do lead depois da data da venda → erro no campo, sem gravar — Task 2.

---

### Task 1: Regras puras da venda

**Files:**
- Create: `src/modulos/comercial/regras/venda.ts`
- Test: `src/modulos/comercial/regras/venda.test.ts`

**Interfaces:**
- Produces:
  - `valorTotal(entrada: string, numeroParcelas: number, valorParcela: string): string` — "AAAA.CC" calculado em centavos.
  - `preencherPelaOferta(o: { precoCheio: string; matricula: string; parcelas: number; valorParcela: string }): { entrada: string; numeroParcelas: number; valorParcela: string }` — regra 2: com parcelas = 0 (à vista), `entrada = precoCheio`, 0 parcelas; com parcelas > 0, `entrada = matricula` e valor da parcela da oferta, ou, se ele for 0, `(precoCheio − matricula) ÷ parcelas` arredondado para centavos.
  - `podeEditarVenda(ator: { id: string; papel: Papel }, venda: { vendedorId: string; criadoEm: Date }, agora: Date): boolean` — com `comercial:gerenciar_vendas`, sempre; senão, só se tem `comercial:registrar_venda`, é o vendedor e `agora − criadoEm ≤ 7 dias`.
  - `vendedorPermitido(ator: { id: string; papel: Papel }, vendedorId: string): boolean` — `comercial:gerenciar_vendas` escolhe qualquer vendedor; os demais, só a si mesmos.
  - `PRAZO_EDICAO_DIAS = 7`.

- [ ] **Step 1: Write the failing tests**
  - `valorTotal("2000.00", 12, "5800.00")` → `"71600.00"`; `valorTotal("0.01", 3, "333.33")` → `"1000.00"`; `valorTotal("2500.00", 0, "0.00")` → `"2500.00"`.
  - `preencherPelaOferta({ precoCheio: "72000.00", matricula: "2000.00", parcelas: 12, valorParcela: "5800.00" })` → `{ entrada: "2000.00", numeroParcelas: 12, valorParcela: "5800.00" }`.
  - `preencherPelaOferta({ precoCheio: "70000.00", matricula: "3000.00", parcelas: 12, valorParcela: "0.00" })` → `valorParcela: "5583.33"`.
  - `preencherPelaOferta({ precoCheio: "2500.00", matricula: "300.00", parcelas: 0, valorParcela: "0.00" })` → `{ entrada: "2500.00", numeroParcelas: 0, valorParcela: "0.00" }`.
  - `podeEditarVenda`: admin e gestor sempre (venda de outro, 30 dias); comercial na própria venda com 6 dias → true, com 8 dias → false, na venda de outro → false; colaborador → false.
  - `vendedorPermitido`: gestor com outro id → true; comercial com o próprio id → true, com outro → false.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/regras/venda.test.ts` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** em `regras/venda.ts` (centavos: `Math.round(Number(v) * 100)`; volta com `(c / 100).toFixed(2)`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): regras de valor, preenchimento e edição de venda`.

---

### Task 2: Esquemas da venda e dos filtros

**Files:**
- Create: `src/modulos/comercial/esquemas/venda.ts`
- Test: `src/modulos/comercial/esquemas/venda.test.ts`

**Interfaces:**
- Consumes: `lerReais` (`@/lib/dinheiro`), `normalizarWhatsapp` (`@/modulos/core/regras/perfil`), `FORMAS_PAGAMENTO` (`../esquemas/produto`), `valorTotal` (Task 1), `PERIODOS` (`@/modulos/tarefas/regras/relatorio`).
- Produces: `esquemaVenda` e `DadosVenda` com `produtoId`, `ofertaId: string | null`, `vendedorId`, `dataVenda` (dia obrigatório), `dataEntradaLead`, `dataEntrega`, `primeiroVencimento` (dia ou `null`), `nomeCliente` (2–150), `whatsappCliente` (só dígitos, 10 ou 11, ou `null`), `canalId: string | null`, `metodoPagamento` (enum `FORMAS_PAGAMENTO`), `entrada` e `valorParcela` (reais, vazio = "0.00"), `numeroParcelas` (0–60, vazio = 0), `observacoes` (≤ 2000 ou `null`). `esquemaFiltrosVendas` com `periodo` (`.catch("mes")`), `de`/`ate` (dia ou `undefined`), `produto?`, `vendedor?`, `canal?`.

- [ ] **Step 1: Write the failing tests**
  - WhatsApp `"(11) 99999-9999"` → `"11999999999"`; `"+55 61 99999-0000"` → `"61999990000"`; `"123"` recusado ("WhatsApp inválido"); vazio → `null`.
  - Total zero (entrada e parcelas vazias) recusado com erro em `entrada`: "Informe o valor da venda".
  - `dataEntradaLead: "2026-11-05"` com `dataVenda: "2026-11-02"` recusado com erro em `dataEntradaLead`: "O lead não pode ter entrado depois da venda".
  - `numeroParcelas: "61"` recusado; `metodoPagamento: "dinheiro"` recusado; `dataVenda` vazio recusado.
  - `esquemaFiltrosVendas.parse({})` → `{ periodo: "mes" }`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/esquemas/venda.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `esquemas/venda.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): validação do formulário de venda`.

---

### Task 3: Modelo, migration e serviço de vendas

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Venda`, enum `MetodoPagamento`, relações em `Usuario`, `Produto`, `OfertaProduto`, `CanalVenda`)
- Create: `prisma/migrations/<timestamp>_comercial_vendas/migration.sql`
- Modify: `src/lib/auditoria.ts` (ações `"venda.criada" | "venda.editada" | "venda.excluida"`)
- Create: `src/modulos/comercial/servicos/vendas.ts`
- Modify: `src/modulos/comercial/servicos/produtos.ts` (`excluirProduto` conta vendas; nova `listarProdutosParaVenda`)

**Interfaces:**
- Consumes: Tasks 1–2; `registrarAuditoria`; `exigirPermissaoComercial`; `intervaloDoPeriodo` (`@/modulos/tarefas/regras/relatorio`, só `primeiroDia`/`ultimoDia`).
- Produces:
  - Prisma `Venda` (tabela `vendas`), campos da spec, seção 4, com `@@index([dataVenda])`, `@@index([vendedorId, dataVenda])`, `@@index([produtoId, dataVenda])`; relações nomeadas `"VendasDoVendedor"` e `"VendasRegistradas"` em `Usuario`.
  - `listarVendedores(): Promise<{ id: string; nome: string }[]>` — ativos com papel `comercial`, `gestor` ou `admin` (regra 5).
  - `listarProdutosParaVenda()` → produtos ativos com `ofertas: { id, nome, padrao, precoCheio, matricula, parcelas, valorParcela }[]` serializadas.
  - `listarVendas(ator, filtros: FiltrosVendas)` → `{ vendas: LinhaVenda[]; total: string; intervalo }`. Sem `comercial:ver_equipe`, só `vendedorId = ator.id`. Ordena por `dataVenda` desc, `criadoEm` desc. Cada linha traz os campos do formulário serializados (datas como "AAAA-MM-DD"), nomes de produto, oferta, vendedor e canal, e `podeEditar` (de `podeEditarVenda`).
  - `criarVenda(ator, dados: DadosVenda): Promise<{ id: string }>`, `editarVenda(ator, id, dados)`, `excluirVenda(ator, id)`.
- Regras no serviço:
  - Criar exige `comercial:registrar_venda` e `vendedorPermitido`; editar e excluir exigem `podeEditarVenda`. Recusa → `ErroPermissao`. Venda inexistente, excluída ou fora do alcance → `ErroNegocio("Não encontrado.")`.
  - Produto precisa estar ativo e não excluído, exceto ao editar sem trocar o produto. A oferta, se houver, precisa ser do produto. O canal, se houver, precisa estar ativo, exceto ao editar sem trocar o canal. O vendedor precisa passar na regra 5. Falha → `ErroNegocio` com mensagem do campo ("Produto indisponível.", "Oferta não pertence ao produto.", "Canal indisponível.", "Vendedor inválido.").
  - `valorTotal` é sempre recalculado no servidor (regra 1).
  - Auditoria na mesma transação: `diff` só com `{ campos: string[]; valorTotal }`, nunca nome ou WhatsApp.
  - `excluirProduto` passa `vendas: await tx.venda.count({ where: { produtoId: id } })` (inclui as excluídas) para `podeExcluirProduto`.

- [ ] **Step 1: Confirm** `git status --short prisma/` vazio.
- [ ] **Step 2: Add** o modelo e as relações; gerar a migration (Global Constraints). Expected: `CREATE TABLE vendas` com as FKs, sem nenhum outro `ALTER` além das FKs da própria tabela.
- [ ] **Step 3: Implement** a auditoria, `servicos/vendas.ts` e as mudanças em `servicos/produtos.ts`.
- [ ] **Step 4: Run** `npm run typecheck` e `npm run test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): modelo e serviço de vendas com auditoria`.

---

### Task 4: Ações, tela de vendas e renomear canais

**Files:**
- Create: `src/modulos/comercial/acoes/vendas.ts`, `src/app/(app)/comercial/vendas/page.tsx`, `src/modulos/comercial/componentes/formulario-venda.tsx`, `src/modulos/comercial/componentes/tabela-vendas.tsx`, `src/modulos/comercial/componentes/filtros-vendas.tsx`
- Modify: `src/modulos/comercial/componentes/abas-comercial.tsx`, `src/app/(app)/comercial/page.tsx`, `src/modulos/comercial/componentes/canais-venda.tsx`

**Interfaces:**
- Consumes: Task 3; `preencherPelaOferta` e `valorTotal` (Task 1, no cliente para o total ao vivo); `formatarReais`, `lerReais`.
- Produces: `salvarVendaAcao(_: EstadoAcao, formData): Promise<EstadoAcao>` (cria sem `id`, edita com `id`; exige `comercial:registrar_venda`), `excluirVendaAcao(id: string)`.

- [ ] **Step 1: Ações** no padrão de `acoes/produtos.ts`, com `revalidatePath("/comercial", "layout")` e mensagens "Venda registrada.", "Venda atualizada.", "Venda excluída.".
- [ ] **Step 2: Abas e redirecionamento**: abas na ordem "Vendas", "Produtos", "Canais"; `/comercial` redireciona para `/comercial/vendas`.
- [ ] **Step 3: Formulário** (`formulario-venda.tsx`, diálogo com `className="sm:max-w-2xl"`, rolagem interna no celular), na ordem da referência do usuário: Produto* e Data da venda* (padrão: hoje em São Paulo); Vendedor* (para quem não tem `comercial:gerenciar_vendas`, fixo no próprio usuário, só leitura) e Data em que o lead entrou; Nome do cliente*; WhatsApp; Canal (só ativos) e Data de entrega; quadro "Forma de pagamento" com Oferta (do produto escolhido, a padrão pré-selecionada; trocar produto ou oferta chama `preencherPelaOferta` e preenche os campos), Método, Entrada, Nº de parcelas, Valor da parcela, 1º vencimento e "Valor total da venda" calculado ao vivo com `valorTotal` (em verde); Observações. Em edição, botão "Excluir venda" com `confirm`. Campos de reais com `inputMode="decimal"`.
- [ ] **Step 4: Lista** (`/comercial/vendas`): filtros na URL (período com intervalo livre, produto, vendedor só com `comercial:ver_equipe`, canal) no padrão de `filtros-relatorio.tsx` do Tarefas; tabela com Data, Produto, Cliente, Vendedor, Canal, Método e Valor total; rodapé "N vendas · R$ total". Clicar numa linha com `podeEditar` abre o formulário em modo edição; sem `podeEditar`, abre só para leitura. Vazio: "Nenhuma venda neste período." com o botão "Registrar venda".
- [ ] **Step 5: Canais**: em `canais-venda.tsx`, nome clicável que vira campo de edição (salva com `salvarCanalAcao` e `id`) — pendência da revisão da entrega 1 (spec §7).
- [ ] **Step 6: Run** `npm run typecheck`, `npx eslint` nos arquivos e `npx next build --webpack` — Expected: PASS, com `/comercial/vendas` na lista de rotas.
- [ ] **Step 7: Commit** — `feat(comercial): tela de vendas com formulário preenchido pela oferta`.

---

### Task 5: Documentação, revisão e publicação

**Files:**
- Modify: `docs/modulos/comercial.md` (entidade `Venda`, tela de vendas, regras 1, 2, 5, 6, 7 e 11 da spec, situação), `docs/04-seguranca-permissoes.md` (auditoria de venda), `docs/03-modelo-de-dados.md` (`Venda`)

- [ ] **Step 1: Write** as atualizações dos docs.
- [ ] **Step 2: Run** `npm run typecheck && npm run test`, `npx eslint` e `npx next build --webpack` — Expected: PASS.
- [ ] **Step 3: Commit** — `docs(comercial): vendas`.
- [ ] **Step 4: Revisão final** por revisor independente (Review Focus acima); corrigir Críticos e Importantes com teste RED→GREEN.
- [ ] **Step 5: Push** para `origin teste` e acompanhar `hosting_get-deployment` (`teste.plataformaipemaster.com.br`) até `completed`, com a migration de vendas aplicada.
- [ ] **Step 6: Roteiro de teste** para o usuário, um passo por vez: registrar uma venda da Pós Transplante Capilar e conferir o preenchimento (R$ 2.000 + 12 × R$ 5.800 = R$ 71.600) → trocar para a oferta "Em 24x" → salvar e ver na lista com o total do rodapé → editar → filtrar por mês passado (some) → excluir → tentar apagar um produto que tem venda (deve recusar) → entrar como vendedor (papel Comercial) e conferir que só vê e registra as próprias vendas.
