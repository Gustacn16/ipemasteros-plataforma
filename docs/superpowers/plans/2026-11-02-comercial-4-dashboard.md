# Comercial — Entrega 4 (Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard comercial em `/comercial`, com tema escuro e visual inspirado na referência do usuário: cartões de números do mês, gráfico Vendido × Meta (6M/12M), ranking de vendedores, tabela por produto, vendas recentes e o cartão "Funil do Kommo — em breve".

**Architecture:** Regras puras de conta em `regras/dashboard.ts`; um serviço `servicos/dashboard.ts` que agrega vendas e metas no banco a cada consulta; a página `src/app/(app)/comercial/page.tsx` (hoje um redirecionamento) passa a ser o dashboard. O tema escuro vale só dentro de um contêiner com a classe `dark` (o `globals.css` já tem `@custom-variant dark (&:is(.dark *))`). O gráfico usa Recharts num componente de cliente.

**Tech Stack:** Next.js 16.4.3 (`--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, Tailwind v4, shadcn, **Recharts 3.10.1** (nova dependência, versão exata).

**Spec:** `docs/superpowers/specs/2026-11-02-comercial-design.md` (seções 3 "Visual" e "Gráfico", 6, 7 navegação, 8, 10.4, 12 risco do tema escuro).

## Global Constraints

- As mesmas das entregas 2 e 3: português; commits só dos próprios arquivos; dinheiro somado em centavos e trafegando como `"1234.56"`; prettier `--print-width 140`; verificação com typecheck, test, eslint e `next build --webpack`. Outra sessão (Acadêmico) commita na mesma branch: **antes do push, perguntar a ela ou ao usuário** se os commits dela podem ir junto.
- `package.json` e `package-lock.json`: instalar com `npm install recharts@3.10.1 --save-exact`. Se `git status` mostrar esses arquivos já alterados por outra sessão, parar e avisar.
- Sem migration nesta entrega.
- Cores do tema escuro: fundo em degradê a partir do grafite da marca `#111416`, cartões translúcidos (`bg-white/5`, borda `white/10`, cantos `rounded-3xl`), destaque no roxo da marca `#5F45F4`. A linha do vendido usa o roxo; a da meta, branco translúcido tracejado. Os textos precisam de contraste AA sobre o fundo.
- Celular é a referência principal: 1 coluna até `md`, 2 a partir de `md` e 4 cartões de números a partir de `lg`.

## Review Focus

1. Mês anterior com vendido zero: o selo de variação não aparece, em vez de "+∞%" ou "NaN%" — Task 1 (`variacao`).
2. Mês sem meta ou sem vendas: "% da meta" e "Ticket médio" mostram "—", e as barras de progresso não quebram com divisão por zero — Task 1.
3. Vendedor `comercial` mudando `?vendedor=` na URL para outra pessoa continua vendo só os próprios números; o ranking não aparece para ele — Task 2 e Task 3.
4. Janela 12M atravessando a virada do ano (dez → jan) e mês sem venda no meio da série aparece como zero, não some do gráfico — Task 1 (`mesesDaJanela`) e Task 2.
5. Vendas excluídas não entram em nenhum número, gráfico ou lista — Task 2.

---

### Task 1: Regras puras do dashboard

**Files:**
- Create: `src/modulos/comercial/regras/dashboard.ts`
- Test: `src/modulos/comercial/regras/dashboard.test.ts`

**Interfaces:**
- Consumes: `mesAnterior`, `MetaChave` (`regras/meta.ts`).
- Produces:
  - `variacao(atual: string, anterior: string): number | null` — % inteiro arredondado; `null` quando o anterior é 0.
  - `ticketMedio(vendido: string, quantidade: number): string | null` — `null` sem vendas.
  - `percentualMeta(realizado: number, alvo: number): number | null` — % inteiro; `null` se alvo = 0. Serve para valor (em centavos) e quantidade.
  - `faixaMeta(percentual: number | null): "verde" | "amarelo" | "vermelho" | null` — verde ≥ 100, amarelo 70–99, vermelho < 70 (spec, seção 8).
  - `mesesDaJanela(ultimo: string, quantidade: number): string[]` — do mais antigo ao `ultimo`, em `"AAAA-MM"`.
  - `resumoSerie(serie: { mes: string; vendido: string; meta: string }[]): { total: string; comMeta: number; bateram: number }` — `bateram` conta os meses com meta > 0 e vendido ≥ meta.

- [ ] **Step 1: Write the failing tests**: `variacao("110.00", "100.00")` → 10; `variacao("90.00", "100.00")` → -10; `variacao("50.00", "0.00")` → null; `ticketMedio("300.00", 3)` → `"100.00"`; `ticketMedio("0.00", 0)` → null; `ticketMedio("100.00", 3)` → `"33.33"`; `percentualMeta(0, 0)` → null; `percentualMeta(7000, 10000)` → 70; `faixaMeta(100)` verde, `faixaMeta(99)` amarelo, `faixaMeta(70)` amarelo, `faixaMeta(69)` vermelho, `faixaMeta(null)` null; `mesesDaJanela("2027-02", 4)` → `["2026-11", "2026-12", "2027-01", "2027-02"]`; `resumoSerie` com meses (vendido 100/meta 100), (vendido 50/meta 100) e (vendido 30/meta 0) → `{ total: "180.00", comMeta: 2, bateram: 1 }`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/regras/dashboard.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `regras/dashboard.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): contas do dashboard (variação, ticket, % da meta e série)`.

---

### Task 2: Serviço do dashboard

**Files:**
- Create: `src/modulos/comercial/esquemas/dashboard.ts`, `src/modulos/comercial/servicos/dashboard.ts`
- Test: `src/modulos/comercial/esquemas/dashboard.test.ts`

**Interfaces:**
- Consumes: Task 1; `esquemaMes`, `primeiroDiaDoMes`, `mesAnterior` (entrega 3); `listarVendedores`; `exigirPermissaoComercial`.
- Produces:
  - `esquemaFiltrosDashboard(agora: Date)` → `{ mes: string; produto?: string; vendedor?: string }` (mês com `esquemaMes`).
  - `obterDashboard(ator, filtros)` → `{ mes, equipe: boolean, numeros: { vendido, quantidade, ticket, variacao, metaValor, metaQuantidade, percentualValor, percentualQuantidade }, serie: { mes, vendido, meta }[] (12 meses, do mais antigo ao mês do filtro), ranking: { vendedorId, nome, imagem, vendido, quantidade, meta, percentual }[], porProduto: { produtoId, nome, vendido, quantidade, metaValor, metaQuantidade, percentualValor }[], recentes: { id, produtoNome, nomeCliente, vendedorNome, valorTotal, dataVenda }[] (6) }`. Todos os valores em reais como string.
- Regras:
  - Sem `comercial:ver_equipe`, o filtro de vendedor é sempre o próprio ator (ignora `?vendedor=`) e `ranking` vem vazio.
  - Toda consulta usa `excluidoEm: null` nas vendas.
  - Vendido do mês, por vendedor e por produto: `prisma.venda.groupBy` com `_sum.valorTotal` e `_count`. Série: vendas dos 12 meses (`dataVenda` entre o dia 1 do primeiro mês e o último dia do mês do filtro) somadas por mês em centavos no JS, com zero nos meses sem venda; metas da janela somadas por mês.
  - Metas seguem os mesmos filtros (produto e vendedor).
  - Ranking: todos os vendedores com venda ou meta no mês, ordenados pelo vendido (maior primeiro), com a foto (`imagem`, a mesma rota protegida usada no menu) e o nome.
  - Por produto: produtos com venda ou meta no mês, ordenados pelo vendido.

- [ ] **Step 1: Write the failing test** de `esquemaFiltrosDashboard`: `?mes=abc` → mês atual; `produto` e `vendedor` vazios → `undefined`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** o esquema e o serviço.
- [ ] **Step 4: Run** `npm run typecheck` e `npm run test` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): consulta do dashboard por mês, produto e vendedor`.

---

### Task 3: Tela do dashboard com tema escuro

**Files:**
- Modify: `package.json`, `package-lock.json` (Recharts)
- Modify: `src/app/(app)/comercial/page.tsx` (vira o dashboard), `src/modulos/comercial/componentes/abas-comercial.tsx` (aba "Dashboard" primeiro, ativa só em `/comercial` exato)
- Create: `src/modulos/comercial/componentes/dashboard/` com `painel-dashboard.tsx` (contêiner `dark` com o fundo), `cartoes-numeros.tsx`, `grafico-vendas.tsx` (cliente, Recharts), `ranking-vendedores.tsx`, `tabela-produtos.tsx`, `vendas-recentes.tsx`, `filtros-dashboard.tsx` (cliente) e `barra-meta.tsx`

**Interfaces:**
- Consumes: Task 2 (`obterDashboard`), Task 1 (`faixaMeta`, `resumoSerie`), `formatarReais`, `rotuloMes`.

- [ ] **Step 1: Install** `npm install recharts@3.10.1 --save-exact` (ver Global Constraints).
- [ ] **Step 2: Página e abas**: `/comercial` chama `obterDashboard` com os filtros da URL e renderiza o painel; aba "Dashboard" na frente de "Vendas".
- [ ] **Step 3: Painel** (`painel-dashboard.tsx`): `div.dark` com fundo em degradê (`bg-[radial-gradient(...)]` partindo de `#111416`, com um brilho roxo `#5F45F4` suave), cantos arredondados e padding próprio, cobrindo a área de conteúdo. Topo: título "Dashboard", mês com "◀ ▶", seletores de produto e de vendedor (o de vendedor só com `equipe`), no estilo de pílulas translúcidas da referência.
- [ ] **Step 4: Cartões** (`cartoes-numeros.tsx`): Vendido no mês (número grande; selo "+12% vs mês passado" verde quando sobe, vermelho quando cai, sem selo quando `variacao` é `null`), Vendas, Ticket médio ("—" sem vendas), % da meta (com a cor de `faixaMeta`; "—" sem meta) e uma linha "R$ X de R$ Y".
- [ ] **Step 5: Gráfico** (`grafico-vendas.tsx`, cliente): alternância "6M"/"12M" (padrão 6M; corta os últimos 6 da série), `LineChart` responsivo com a linha do vendido (roxo, área suave abaixo) e a da meta (tracejada); eixo Y em "R$ 100 mil"; dica com mês, vendido e meta; resumo "R$ X em N meses · K de M bateram a meta" de `resumoSerie`.
- [ ] **Step 6: Ranking** (só com `equipe`): foto ou iniciais, nome, vendido, quantidade e `barra-meta.tsx` (barra com a cor de `faixaMeta` e o %; "—" sem meta). **Por produto**: lista com nome, vendido / meta, vendas / meta e a barra. **Vendas recentes**: as 6 últimas em cartões (produto, cliente, vendedor, valor, data), com rolagem lateral no celular. **Funil do Kommo**: cartão "Em breve" com texto curto.
- [ ] **Step 7: Vazio**: mês sem vendas e sem metas mostra os cartões zerados e a mensagem "Nenhuma venda registrada neste mês." no lugar das listas.
- [ ] **Step 8: Run** `npm run typecheck`, `npx eslint` nos arquivos e `npx next build --webpack` — Expected: PASS, com `/comercial` na lista de rotas.
- [ ] **Step 9: Commit** — `feat(comercial): dashboard escuro com números, gráfico, ranking e vendas recentes` (inclui `package.json` e `package-lock.json`).

---

### Task 4: Documentação, revisão e publicação

**Files:**
- Modify: `docs/modulos/comercial.md` (tela do dashboard, situação "Entrega 4 (feito)" e próximas especificações: Kommo, parcelas/MRR, comissão), `docs/01-visao-geral.md` (se mencionar o dashboard como futuro)

- [ ] **Step 1: Write** as atualizações dos docs.
- [ ] **Step 2: Run** `npm run typecheck && npm run test`, `npx eslint` e `npx next build --webpack` — Expected: PASS.
- [ ] **Step 3: Commit** — `docs(comercial): dashboard`.
- [ ] **Step 4: Revisão final** por revisor independente (Review Focus acima); corrigir Críticos e Importantes com teste RED→GREEN.
- [ ] **Step 5: Push** (com a confirmação sobre os commits do Acadêmico) e acompanhar `hosting_get-deployment` até `completed`.
- [ ] **Step 6: Roteiro de teste** para o usuário, um passo por vez: abrir Comercial (abre no Dashboard) → conferir Vendido, Vendas, Ticket e % da meta com as vendas e metas cadastradas nos testes anteriores → alternar 6M/12M → trocar o mês para outubro (números do mês passado) → filtrar por um produto → filtrar por um vendedor → conferir o ranking e as vendas recentes → abrir no celular → entrar como vendedor e conferir que só aparecem os números dele, sem ranking.
