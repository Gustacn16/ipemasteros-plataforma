# Meta Ads — Entrega 3 (Mídia no dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visão **Mídia** no dashboard comercial (`/comercial?visao=midia`), com investimento, leads por tipo, CPL, CAC, ROAS, gráfico mensal de investimento × leads e a tabela por campanha, no mesmo tema escuro.

**Architecture:** Regras puras em `regras/midia.ts`; consulta em `servicos/dashboard-midia.ts` (agrega `MetricaDiariaAnuncio` por mês e por campanha e reaproveita as vendas do mês para CAC e ROAS); componentes em `componentes/dashboard/midia/`; seletor "Vendas | Mídia" no painel do dashboard.

**Tech Stack:** Next.js 16.4.3 (`--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, Recharts 3.10.1.

**Spec:** `docs/superpowers/specs/2026-11-02-meta-ads-design.md` (seções 5.7, 5.9, 5.10, 6, 7 Dashboard, 9.3). **Mudanças pedidas pelo usuário em 2026-11-04**, que valem sobre a spec: (1) em vez de uma faixa de cartões na visão de vendas, uma **opção de mídia** própria no dashboard (seletor "Vendas | Mídia"); (2) a entrega 2 (atribuição) fica para depois, então nesta entrega o filtro de produto não se aplica à mídia, e a tabela é por **campanha** em vez de por produto.

## Global Constraints

- As mesmas das entregas anteriores: português; commits só dos próprios arquivos; prettier `--print-width 140`; typecheck, test, eslint e `next build --webpack`; antes do push, conferir commits de outras sessões em `git log origin/teste..HEAD` e perguntar ao usuário ou à sessão dona.
- Sem migration.
- Só quem tem `comercial:ver_marketing` vê o seletor e a visão Mídia; os demais, com `?visao=midia` na URL, caem na visão Vendas.
- Só contas com moeda `BRL` e `ativa: true` entram nas somas (spec 5.7).
- Dinheiro somado em centavos; datas das métricas são dias (`@db.Date`), o mês é `data` entre o dia 1 e o dia 1 do mês seguinte.
- Antes de 2026-11-01, CAC e ROAS mostram "—" (spec 5.9).

## Review Focus

1. Mês sem investimento ou sem leads → CPL, ROAS e a variação mostram "—", sem "Infinity" ou "NaN" — Task 1.
2. Conta em outra moeda ou desligada na importação não entra em nenhum número da visão Mídia — Task 2.
3. Vendedor (`comercial`) com `?visao=midia` não vê nenhum número de mídia, nem no HTML enviado ao navegador — Task 3.
4. Mês de outubro de 2026 ou anterior: CAC e ROAS "—", mesmo havendo vendas registradas por engano naquele mês — Task 1.
5. Campanha com investimento zero no mês não aparece na tabela; campanha com leads e sem investimento aparece com CPL "—" — Task 2.

---

### Task 1: Regras puras da mídia

**Files:**
- Create: `src/modulos/comercial/regras/midia.ts`
- Test: `src/modulos/comercial/regras/midia.test.ts`

**Interfaces:**
- Consumes: `variacao` (`regras/dashboard.ts`).
- Produces:
  - `INICIO_VENDAS_NO_SISTEMA = "2026-11"`.
  - `custoPorLead(investimentoCentavos: number, leads: number): string | null`.
  - `cac(investimentoCentavos: number, vendas: number, mes: string): string | null` — `null` sem vendas ou com `mes < INICIO_VENDAS_NO_SISTEMA`.
  - `roas(vendidoCentavos: number, investimentoCentavos: number, mes: string): number | null` — uma casa decimal (ex.: 4.2); `null` sem investimento ou antes do corte.
  - `formatarRoas(r: number | null): string` → "4,2x" ou "—".
  - `totalLeads(l: { leadsFormulario: number; leadsSite: number; conversasIniciadas: number }): number`.

- [ ] **Step 1: Write the failing tests**: `custoPorLead(10000, 4)` → "25.00", `(10000, 0)` → null; `cac(100000, 4, "2026-11")` → "250.00", `(100000, 0, "2026-11")` → null, `(100000, 4, "2026-10")` → null; `roas(420000, 100000, "2026-11")` → 4.2, `(420000, 0, "2026-11")` → null, `(420000, 100000, "2026-10")` → null; `formatarRoas(4.2)` → "4,2x", `formatarRoas(null)` → "—"; `totalLeads({2,3,5})` → 10.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial/regras/midia.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): contas da visão de mídia (CPL, CAC e ROAS)`.

---

### Task 2: Consulta da visão Mídia

**Files:**
- Create: `src/modulos/comercial/servicos/dashboard-midia.ts`
- Modify: `src/modulos/comercial/servicos/importacao-meta.ts` (`MAX_TIPOS_IGNORADOS` de 20 para 60, para não cortar a lista na tela)

**Interfaces:**
- Consumes: Task 1; `mesesDaJanela`, `mesAnterior`, `mesSeguinte`, `primeiroDiaDoMes`.
- Produces: `obterMidia(ator, mes: string)` → exige `comercial:ver_marketing` e devolve `{ mes, atualizadoEm: string | null (finalizadoEm da última importação concluida, ISO), conectada: boolean, numeros: { investimento, variacaoInvestimento, leads, leadsFormulario, leadsSite, conversasIniciadas, cpl, cac, roas, vendas, vendido }, serie: { mes, investimento, leads }[] (12 meses, do mais antigo ao do filtro), campanhas: { id, nome, conta, investimento, leads, cpl }[] (do maior investimento ao menor; só com investimento > 0 ou leads > 0) }`.
- Regras: somas com `prisma.metricaDiariaAnuncio.findMany` na janela de 12 meses, filtrando `campanha: { conta: { ativa: true, moeda: "BRL" } }`, agrupadas por mês e por campanha no JS, em centavos. Vendas e vendido do mês vêm de `prisma.venda.aggregate` (`excluidoEm: null`) da equipe inteira (sem filtro de vendedor nem de produto).

- [ ] **Step 1: Implement** o serviço e o ajuste do limite.
- [ ] **Step 2: Run** `npm run typecheck` e `npm run test` — Expected: PASS.
- [ ] **Step 3: Commit** — `feat(comercial): consulta da visão de mídia do dashboard`.

---

### Task 3: Tela da visão Mídia

**Files:**
- Create: `src/modulos/comercial/componentes/dashboard/midia/painel-midia.tsx`, `grafico-midia.tsx` (cliente, Recharts), `tabela-campanhas.tsx`
- Modify: `src/modulos/comercial/componentes/dashboard/painel-dashboard.tsx` (seletor "Vendas | Mídia" como pílulas, link para `?visao=…` mantendo `mes`), `src/app/(app)/comercial/page.tsx` (lê `visao`; só chama `obterMidia` com a permissão), `src/modulos/comercial/esquemas/dashboard.ts` (`visao: "vendas" | "midia"`, `.catch("vendas")`)

**Interfaces:**
- Consumes: Task 2; `cartao`, `pilula`, `reaisCompacto`, `mesCurto` (`componentes/dashboard/estilos.ts`); `formatarReais`; `formatarRoas`.

- [ ] **Step 1: Write the failing test** em `esquemas/dashboard.test.ts`: `visao` ausente ou inválida → "vendas"; "midia" → "midia".
- [ ] **Step 2: Run** — Expected: FAIL. **Step 3:** implementar o esquema. **Step 4:** PASS.
- [ ] **Step 5: Seletor**: no topo do painel, ao lado do título, duas pílulas "Vendas" e "Mídia" (`aria-current` na ativa), só com `comercial:ver_marketing`. Na visão Mídia, o filtro de vendedor e o de produto somem e aparece a nota "O filtro por produto chega com a ligação de campanhas a produtos.".
- [ ] **Step 6: Cartões**: Investimento (com o selo de variação, verde se subiu e vermelho se caiu, igual ao do vendido), Leads (com "X formulário · Y site · Z WhatsApp" embaixo), Custo por lead, CAC e ROAS ("—" quando não houver). Embaixo do título: "Dados da Meta atualizados em DD/MM às HH:MM", ou "Meta Ads não conectada" com link para `/comercial/integracao-meta` quando não houver nenhuma importação concluída.
- [ ] **Step 7: Gráfico** (cliente): barras do investimento por mês (roxo `#8b7bff`) e linha dos leads (branco translúcido) em eixo próprio à direita; alternância 6M/12M; dica com mês, investimento, leads e CPL.
- [ ] **Step 8: Tabela por campanha**: nome, conta, investimento, leads e CPL, com rolagem lateral no celular; vazio: "Nenhum investimento registrado neste mês.".
- [ ] **Step 9: Verificação visual** com uma página temporária de prévia (dados de exemplo, não commitada), no computador e a 375 px, como na entrega 4 do Comercial; depois apagar a prévia e a pasta `.next/dev`.
- [ ] **Step 10: Run** `npm run typecheck`, `npx eslint` e `npx next build --webpack` — Expected: PASS.
- [ ] **Step 11: Commit** — `feat(comercial): visão de mídia no dashboard`.

---

### Task 4: Docs, revisão e publicação

- [ ] **Step 1:** atualizar `docs/modulos/comercial.md` (visão Mídia; situação: entrega 3 do Meta Ads feita; entrega 2, de atribuição, pendente) e a spec do Meta Ads (seção "Mudanças de 2026-11-04").
- [ ] **Step 2:** typecheck, test, eslint e build — PASS. Commit `docs(comercial): visão de mídia`.
- [ ] **Step 3:** revisão final por revisor independente (Review Focus); corrigir Críticos e Importantes com teste RED→GREEN.
- [ ] **Step 4:** push (perguntando sobre commits de outras sessões) e acompanhar o deploy até `completed`.
- [ ] **Step 5:** roteiro de teste para o usuário: abrir o Dashboard → clicar em "Mídia" → comparar o investimento e os leads de outubro com o Gerenciador de Anúncios (mesmo período, mesmas contas) → conferir a divisão formulário/WhatsApp → alternar 6M/12M → ver a tabela de campanhas → voltar para "Vendas".
