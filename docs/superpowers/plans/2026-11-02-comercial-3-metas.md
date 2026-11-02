# Comercial — Entrega 3 (Metas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar as metas do mês por produto e vendedor (valor e quantidade), com totais e o botão "Copiar do mês anterior", e impedir a exclusão de produto que tenha meta.

**Architecture:** Mesmo padrão das entregas 1 e 2 no módulo `src/modulos/comercial/`: regras puras em `regras/meta.ts`, esquema em `esquemas/meta.ts`, serviço `servicos/metas.ts`, ações `acoes/metas.ts`, tela `src/app/(app)/comercial/metas/page.tsx`. Uma migration de estrutura.

**Tech Stack:** Next.js 16.4.3 (`--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, shadcn.

**Spec:** `docs/superpowers/specs/2026-11-02-comercial-design.md` (seções 4 `MetaVenda`, 5.3–5.5, 5.9, 6, 7 `/comercial/metas`, 10.3).

## Global Constraints

- As mesmas da entrega 2 (`docs/superpowers/plans/2026-11-02-comercial-2-vendas.md`, Global Constraints): português; commits só dos próprios arquivos; dinheiro em centavos inteiros e trafegando como `"1234.56"`; `git status --short prisma/` vazio antes de mexer no schema; migration via `prisma migrate diff`; formatar com prettier `--print-width 140`; verificação com typecheck, test, eslint e `next build --webpack`.
- Mês sempre como `"AAAA-MM"` na tela e na URL (`?mes=2026-11`) e como `@db.Date` no dia 1 no banco. O mês padrão é o mês atual em São Paulo.
- Metas não têm dado pessoal: não geram auditoria (spec, regra 7, vale só para vendas).

## Review Focus

1. Gravar uma linha com valor e quantidade vazios ou zero apaga a meta daquela pessoa (não grava meta zerada) — Task 1 (`metaVazia`) e Task 3.
2. "Copiar do mês anterior" duas vezes seguidas não duplica nem sobrescreve o que já foi editado — Task 1 (`metasParaCopiar`) e a chave única do banco na Task 3.
3. Mês inválido na URL (`?mes=2026-13`, `?mes=abc`) cai no mês atual, sem erro — Task 2.
4. Vendedor `comercial` chamando a ação de salvar metas direto → "sem permissão"; na tela, ele vê só as próprias metas — Task 3 e Task 4.
5. Produto desativado que já tem meta no mês continua aparecendo naquele mês (para conferir e corrigir), mas não entra em meses novos nem no "copiar" — Task 1 e Task 3.

---

### Task 1: Regras puras das metas

**Files:**
- Create: `src/modulos/comercial/regras/meta.ts`
- Test: `src/modulos/comercial/regras/meta.test.ts`

**Interfaces:**
- Produces:
  - `mesAtual(agora: Date): string` → `"AAAA-MM"` em São Paulo (usa `diaEmSaoPaulo` de `@/modulos/tarefas/regras/prazo`).
  - `mesAnterior(mes: string): string`, `mesSeguinte(mes: string): string` (`"2027-01"` → `"2026-12"`).
  - `primeiroDiaDoMes(mes: string): string` → `"AAAA-MM-01"`.
  - `rotuloMes(mes: string): string` → `"novembro de 2026"`.
  - `metaVazia(l: { valorAlvo: string; quantidadeAlvo: number }): boolean` — valor e quantidade iguais a zero.
  - `metasParaCopiar(anteriores: MetaChave[], existentes: { produtoId: string; vendedorId: string }[], ativos: { produtos: string[]; vendedores: string[] }): MetaChave[]`, com `MetaChave = { produtoId: string; vendedorId: string; valorAlvo: string; quantidadeAlvo: number }` — regra 9.
  - `totaisMetas(metas: MetaChave[]): { porProduto: Record<string, Total>; porVendedor: Record<string, Total>; geral: Total }`, com `Total = { valor: string; quantidade: number }`, somando em centavos.

- [ ] **Step 1: Write the failing tests**: `mesAnterior("2027-01")` → `"2026-12"`; `mesSeguinte("2026-12")` → `"2027-01"`; `mesAtual` às 22h de 30/11 em Brasília (já 01/12 em UTC) → `"2026-11"`; `rotuloMes("2026-11")` → `"novembro de 2026"`; `metaVazia` com `"0.00"`/0 → true e com quantidade 1 → false; `metasParaCopiar` não repete a meta que já existe, ignora produto inativo e vendedor inativo, e copia valor e quantidade das demais; `totaisMetas` soma `"0.10"` + `"0.20"` → `"0.30"` e conta as quantidades por produto, por vendedor e no geral.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/regras/meta.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `regras/meta.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): regras de mês, cópia e totais das metas`.

---

### Task 2: Esquemas das metas

**Files:**
- Create: `src/modulos/comercial/esquemas/meta.ts`
- Test: `src/modulos/comercial/esquemas/meta.test.ts`

**Interfaces:**
- Consumes: `lerReais`, `mesAtual` (Task 1).
- Produces:
  - `esquemaMes(agora: Date)` → schema Zod de `"AAAA-MM"` com `.catch(mesAtual(agora))` (aceita meses 01–12 e anos 2020–2100).
  - `esquemaMetasProduto` e `DadosMetasProduto` = `{ mes: string; produtoId: string; linhas: { vendedorId: string; valorAlvo: string; quantidadeAlvo: number }[] }`, com valor vazio = `"0.00"`, quantidade vazia = 0, quantidade inteira de 0 a 10000 e valor válido em reais (erro "Valor inválido").

- [ ] **Step 1: Write the failing tests**: `esquemaMes(agora).parse("2026-13")` e `.parse("abc")` → mês atual; `.parse("2026-10")` → `"2026-10"`; `esquemaMetasProduto` lê `"R$ 360.000,00"` → `"360000.00"`, quantidade `""` → 0, recusa quantidade `"-1"` e `"1,5"` e valor `"abc"`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/esquemas/meta.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `esquemas/meta.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): validação das metas`.

---

### Task 3: Modelo, migration e serviço das metas

**Files:**
- Modify: `prisma/schema.prisma` (modelo `MetaVenda`, tabela `metas_venda`; relações em `Produto` e `Usuario` com nome `"MetasDoVendedor"`)
- Create: `prisma/migrations/<timestamp>_comercial_metas/migration.sql`
- Create: `src/modulos/comercial/servicos/metas.ts`
- Modify: `src/modulos/comercial/servicos/produtos.ts` (`excluirProduto` conta metas)

**Interfaces:**
- Consumes: Tasks 1–2; `listarVendedores` (`servicos/vendas.ts`); `exigirPermissaoComercial`.
- Produces:
  - Prisma `MetaVenda`: `id`, `mes` (`@db.Date`), `produtoId`, `vendedorId`, `valorAlvo` (`Decimal(12,2)`), `quantidadeAlvo` (Int), `criadoEm`, `atualizadoEm`; `@@unique([mes, produtoId, vendedorId])`, `@@index([vendedorId, mes])`.
  - `obterMetasDoMes(ator, mes: string)` → `{ mes, podeEditar: boolean, produtos: { id, nome, tipo, ativo }[], vendedores: { id, nome }[], metas: MetaChave[] }`. Produtos: ativos e não excluídos, mais os que já têm meta no mês (regra 3). Vendedores: os de `listarVendedores`, mais os que já têm meta no mês. Sem `comercial:ver_equipe`, só as metas, a linha e o vendedor do próprio ator, e `podeEditar: false`.
  - `salvarMetasProduto(ator, dados: DadosMetasProduto): Promise<void>` — exige `comercial:gerenciar_metas`; produto não excluído; cada vendedor válido pela regra 5 ou já com meta nesse mês e produto; numa transação, linha vazia (`metaVazia`) apaga, as demais fazem `upsert` pela chave única.
  - `copiarMetasMesAnterior(ator, mes: string): Promise<number>` — exige `comercial:gerenciar_metas`; usa `metasParaCopiar` com produtos ativos e vendedores ativos; `createMany` com `skipDuplicates: true`; devolve quantas criou.
  - `excluirProduto` passa `metas: await tx.metaVenda.count({ where: { produtoId: id } })` para `podeExcluirProduto`.

- [ ] **Step 1: Confirm** `git status --short prisma/` vazio.
- [ ] **Step 2: Add** o modelo e as relações; gerar a migration. Expected: só `CREATE TABLE metas_venda`, o índice único, o índice e as 2 FKs.
- [ ] **Step 3: Implement** `servicos/metas.ts` e a mudança em `excluirProduto`.
- [ ] **Step 4: Run** `npm run typecheck` e `npm run test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): modelo e serviço das metas`.

---

### Task 4: Ações e tela de metas

**Files:**
- Create: `src/modulos/comercial/acoes/metas.ts`, `src/app/(app)/comercial/metas/page.tsx`, `src/modulos/comercial/componentes/metas-mes.tsx`
- Modify: `src/modulos/comercial/componentes/abas-comercial.tsx` (aba "Metas" entre "Vendas" e "Produtos")

**Interfaces:**
- Consumes: Task 3; `formatarReais`; `rotuloMes`, `mesAnterior`, `mesSeguinte`, `totaisMetas` (Task 1).
- Produces: `salvarMetasProdutoAcao(_: EstadoAcao, formData): Promise<EstadoAcao>` (lê `mes`, `produtoId` e as listas `vendedorId`, `valorAlvo`, `quantidadeAlvo` com `formData.getAll`; mensagem "Metas salvas."); `copiarMetasAcao(mes: string): Promise<EstadoAcao>` (mensagem "N metas copiadas de outubro de 2026." ou "Nenhuma meta nova para copiar."). As duas exigem `comercial:gerenciar_metas` e revalidam `/comercial`.

- [ ] **Step 1: Ações** no padrão de `acoes/vendas.ts`.
- [ ] **Step 2: Tela `/comercial/metas`**: `?mes=` lido com `esquemaMes`. Topo: "◀ novembro de 2026 ▶" (links para o mês anterior e o seguinte), total geral do mês (valor e quantidade) e, para quem gerencia, o botão "Copiar do mês anterior" (com `confirm`). Um cartão por produto, em prateleiras por tipo na mesma ordem da estante (Pós-Graduação, Curso Livre, Paciente Modelo), com o selo "Inativo" quando for o caso. Em cada cartão, uma linha por vendedor (nome, Valor R$ e Quantidade), a linha "Total do produto" e o botão "Salvar" do cartão. No fim, a tabela "Total por vendedor". Quem não gerencia vê os mesmos cartões só com a própria linha, sem campos nem botões. Sem vendedores: "Cadastre usuários com o papel Comercial para definir metas."
- [ ] **Step 3: Aba** "Metas" nas abas do módulo.
- [ ] **Step 4: Run** `npm run typecheck`, `npx eslint` nos arquivos e `npx next build --webpack` — Expected: PASS, com `/comercial/metas` na lista de rotas.
- [ ] **Step 5: Commit** — `feat(comercial): tela de metas do mês por produto e vendedor`.

---

### Task 5: Documentação, revisão e publicação

**Files:**
- Modify: `docs/modulos/comercial.md` (entidade `MetaVenda`, tela de metas, regras 9 e 4 atualizada, situação), `docs/03-modelo-de-dados.md`

- [ ] **Step 1: Write** as atualizações dos docs.
- [ ] **Step 2: Run** `npm run typecheck && npm run test`, `npx eslint` e `npx next build --webpack` — Expected: PASS.
- [ ] **Step 3: Commit** — `docs(comercial): metas`.
- [ ] **Step 4: Revisão final** por revisor independente (Review Focus acima); corrigir Críticos e Importantes com teste RED→GREEN.
- [ ] **Step 5: Push** para `origin teste` e acompanhar `hosting_get-deployment` até `completed`, com a migration de metas aplicada.
- [ ] **Step 6: Roteiro de teste** para o usuário, um passo por vez: abrir Metas → definir valor e quantidade de 2 vendedores na Pós Transplante Capilar e salvar → conferir os totais do produto e por vendedor → ir para o mês seguinte e "Copiar do mês anterior" → mudar um valor no mês novo → copiar de novo (não deve sobrescrever) → apagar uma meta deixando valor e quantidade vazios → tentar apagar na estante um produto que tem meta (deve recusar) → entrar como vendedor e conferir que ele só vê as próprias metas.
