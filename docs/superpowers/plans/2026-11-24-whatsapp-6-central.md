# WhatsApp entrega 6 — Central reorganizada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar as seis abas soltas do WhatsApp por um menu em seções, com uma Visão geral nova e uma página de Configurações, sem quebrar nenhum link atual.

**Architecture:** As rotas atuais ficam onde estão (nenhum link quebra, nada a redirecionar). Um componente de navegação em dois níveis (seção → abas) substitui `AbasWhatsapp`. Duas rotas novas: `/whatsapp/visao-geral` (lê serviços que já existem e junta num panorama) e `/whatsapp/configuracoes` (recebe o formulário de regras de atendimento, hoje no rodapé do Atendimento, e o limite de IA, hoje só em /admin/saude).

**Tech Stack:** Next.js 16 App Router (Server Components), Prisma 7/MySQL, Vitest, componentes de `src/componentes/`.

**Spec:** `docs/superpowers/specs/2026-11-24-whatsapp-central-avisos-api-oficial-design.md` (§5 e §5.1; entrega 6 do §9).

## Global Constraints

- Textos da tela em português simples, sem jargão.
- Nunca usar `contains`/`startsWith`/`endsWith` do Prisma (erro de collation P2039/1267 no MySQL da Hostinger).
- Datas: São Paulo é UTC-3 fixo; usar `janelaDeOntem`, `semanaDaConsulta` de `src/modulos/whatsapp/regras/dia.ts`.
- Permissões não mudam nesta entrega: Visão geral exige `whatsapp:ver_equipe`; Configurações exige `whatsapp:gerenciar_numeros`; editar regras continua só para `admin` (como hoje); vendedor (`comercial`) continua vendo só Conversas e Números.
- Seções e abas, nesta ordem (as seções Grupos→Avisos e API oficial ganham abas nas entregas 7–9; não criar páginas vazias agora):
  - Visão geral (`/whatsapp/visao-geral`)
  - Grupos → Grupos (`/whatsapp/grupos`)
  - Equipe → Atendimento · Leads · CS · Conversas
  - Configurações → Números (`/whatsapp/numeros`) · Ajustes (`/whatsapp/configuracoes`)
- Uma seção só aparece se o papel pode abrir ao menos uma aba dela; a linha de abas só aparece se a seção ativa tem 2 ou mais abas visíveis.
- `/whatsapp` redireciona para a primeira aba visível do papel (gestão cai na Visão geral; vendedor em Conversas).
- Commits só dos arquivos da tarefa: `git add -- <arquivos>` e `git commit -m ... -- <arquivos>`; nunca `git add -A`, stash, reset ou trocar de branch.

## Review Focus

1. Papel `comercial` (vendedor): não pode ver a seção Visão geral nem Configurações→Ajustes, e `/whatsapp` precisa levá-lo a Conversas, não a uma página que o expulsa.
2. Nenhum número conectado / sem avaliações ontem / sem número de CS: a Visão geral mostra zeros e textos de "sem dados", sem quebrar.
3. Um serviço da Visão geral falha (ex.: CS sem número `cs` devolve `semNumeroCs`): o resto da página aparece.
4. Página de detalhe da conversa (`/whatsapp/conversas/[id]`) não tem abas hoje; continua funcionando e com o link de volta para Conversas.
5. `/admin/saude` continua mostrando o limite de IA (a Configurações é um lugar a mais, não um lugar no lugar).

---

### Task 1: Navegação em seções

**Files:**
- Modify: `src/modulos/whatsapp/componentes/abas-whatsapp.tsx`
- Modify: `src/modulos/whatsapp/componentes/abas-whatsapp.test.ts`
- Modify: as páginas que usam `AbasWhatsapp` (`grupos`, `atendimento`, `leads`, `cs`, `conversas`, `numeros` em `src/app/(app)/whatsapp/`) — só se a assinatura mudar; `ativa` continua a mesma chave.
- Modify: `src/app/(app)/whatsapp/page.tsx` (sem mudança de lógica se `abasDoPapel` já devolver na ordem nova).

**Interfaces:**
- Produces:
  - `type AbaWhatsapp = "visao-geral" | "grupos" | "atendimento" | "leads" | "cs" | "conversas" | "numeros" | "configuracoes"`
  - `type SecaoWhatsapp = "visao-geral" | "grupos" | "equipe" | "configuracoes"`
  - `secoesDoPapel(papel: Papel): { chave: SecaoWhatsapp; rotulo: string; href: string; abas: { chave: AbaWhatsapp; href: string; rotulo: string }[] }[]` — só seções com abas visíveis; `href` da seção = primeira aba visível.
  - `abasDoPapel(papel: Papel)` — continua existindo: lista achatada das abas visíveis na ordem das seções.
  - `AbasWhatsapp({ papel, ativa }: { papel: Papel; ativa: AbaWhatsapp })` — desenha a linha de seções e, embaixo, as abas da seção ativa (se ≥ 2).
- Rótulos: seções "Visão geral", "Grupos", "Equipe", "Configurações"; abas "Visão geral", "Grupos", "Atendimento", "Leads", "CS", "Conversas", "Números", "Ajustes".
- Permissões por aba: visao-geral `["whatsapp:ver_equipe"]`; configuracoes `["whatsapp:gerenciar_numeros"]`; as demais como hoje.

- [ ] **Step 1: Escrever os testes que falham** em `abas-whatsapp.test.ts`:

```ts
it("gestor vê as quatro seções na ordem", () => {
  expect(secoesDoPapel("gestor").map((s) => s.chave)).toEqual(["visao-geral", "grupos", "equipe", "configuracoes"]);
  expect(abasDoPapel("gestor").map((a) => a.chave)).toEqual([
    "visao-geral", "grupos", "atendimento", "leads", "cs", "conversas", "numeros", "configuracoes",
  ]);
});
it("vendedor vê só Equipe (Conversas) e Configurações (Números)", () => {
  const secoes = secoesDoPapel("comercial");
  expect(secoes.map((s) => s.chave)).toEqual(["equipe", "configuracoes"]);
  expect(secoes[0].abas.map((a) => a.chave)).toEqual(["conversas"]);
  expect(secoes[1].abas.map((a) => a.chave)).toEqual(["numeros"]);
  expect(secoes[0].href).toBe("/whatsapp/conversas");
  expect(abasDoPapel("comercial")[0].href).toBe("/whatsapp/conversas");
});
```
Apagar o teste antigo que fixava a ordem de 6 abas.

- [ ] **Step 2:** `npx vitest run src/modulos/whatsapp/componentes/abas-whatsapp.test.ts` → FAIL (`secoesDoPapel` não existe).
- [ ] **Step 3:** Implementar. A linha de seções usa o mesmo estilo de hoje (borda inferior, ativa com `border-primary`); a linha de abas embaixo, menor (`text-xs`, fundo `bg-muted` arredondado para a ativa). `aria-label`: "Seções do WhatsApp" e "Abas da seção".
- [ ] **Step 4:** Teste passa; `DATABASE_URL=mysql://u:p@127.0.0.1:3306/x npx next typegen && npx tsc --noEmit` sem erros novos (os de `node-html-parser` já existiam).
- [ ] **Step 5:** Commit `feat(whatsapp): menu da área em seções`.

### Task 2: Serviço do panorama

**Files:**
- Create: `src/modulos/whatsapp/servicos/visao-geral.ts`
- Test: `src/modulos/whatsapp/servicos/visao-geral.test.ts`

**Interfaces:**
- Consumes: `listarNumeros(ator)` (`servicos/numeros.ts`), `semRespostaAgora(ator, agora)` e `resumoDaSemana(ator, semana, { agora, semResposta })` (`servicos/painel-atendimento.ts`), `listarLeads(ator, dia, {})` (`servicos/leads.ts`), `listarVendasCs(ator, inicio, fim, agora, { incluirAguardandoAnteriores: true })` (`servicos/cs.ts`), `semanaDaConsulta(undefined, agora)` e `janelaDeOntem(agora)` (`regras/dia.ts`).
- Produces:

```ts
export type NumeroPanorama = {
  id: string; nome: string; time: TimeNumeroWhatsapp; dono: string | null;
  estado: string; rotulo: string; desde: Date | null;
  conversasSemana: number; semRespostaAgora: number; notaDecimos: number | null;
};
export type Panorama = {
  numeros: NumeroPanorama[];
  oportunidades: { quentes: number; mornos: number; diaAvaliado: Date } | null;
  atencao: { semRespostaAgora: number; csAguardando: number | null; desconectados: number };
};
export async function panoramaWhatsapp(ator: UsuarioAtual, agora?: Date): Promise<Panorama>;
```
- Regras: exige `whatsapp:ver_equipe` (lança `ErroPermissao`). `desde` = `conectadoEm` se conectado, senão `ultimoSinalEm`. `oportunidades` conta itens de `listarLeads` do dia de `janelaDeOntem(agora).dia` com `temperatura` quente/morno e `situacaoLead` fora de `fechou`/`perdido`; `null` se a chamada lançar. `csAguardando` = `aguardando` de `listarVendasCs` no mês corrente de São Paulo até `agora`; `null` se `semNumeroCs` ou se lançar. `desconectados` = números com estado diferente de conectado. Cada bloco tolera falha do seu serviço sem derrubar os outros (`Promise.allSettled`).

- [ ] **Step 1: Testes que falham** (mockar os serviços consumidos com `vi.mock`, como em `painel-atendimento.test.ts`):
  - `panoramaWhatsapp` com papel `comercial` → rejeita com `ErroPermissao`.
  - 2 números (um conectado com 12 conversas na semana e 2 sem resposta; um desconectado) → `numeros[0].conversasSemana === 12`, `numeros[0].semRespostaAgora === 2`, `atencao.desconectados === 1`, `atencao.semRespostaAgora === 2`.
  - leads: 3 quentes (1 `fechou`), 2 mornos, 4 frios → `oportunidades` = `{ quentes: 2, mornos: 2 }`.
  - `listarLeads` rejeita → `oportunidades === null` e o resto preenchido.
  - `listarVendasCs` devolve `semNumeroCs: true` → `csAguardando === null`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS; typecheck.
- [ ] **Step 5:** Commit `feat(whatsapp): panorama da visão geral`.

### Task 3: Página Visão geral

**Files:**
- Create: `src/app/(app)/whatsapp/visao-geral/page.tsx`
- Create: `src/modulos/whatsapp/componentes/visao-geral.tsx`

**Interfaces:**
- Consumes: `panoramaWhatsapp` (Task 2), `AbasWhatsapp` com `ativa="visao-geral"` (Task 1), `exigirPermissaoPagina("whatsapp:ver_equipe")`, `CabecalhoPagina`, `Card*`.

- [ ] **Step 1:** Página com título "WhatsApp" e descrição "Como estão os números, as oportunidades e o que precisa de atenção." Três cartões, na ordem do esboço do spec §5.1:
  - **Números:** uma linha por número: nome, time (rótulo humano), dono, bolinha de estado + rótulo, "N conversas na semana", "N sem resposta agora" (destaque se > 0), nota IA formatada com `formatarNota` de `regras/avaliacao.ts`. Linha leva a `/whatsapp/atendimento?numero=<id>`. Sem números: "Nenhum número cadastrado" com link para Números.
  - **Oportunidades:** "N leads quentes" → `/whatsapp/leads?temperatura=quente`; "N leads mornos" → `/whatsapp/leads?temperatura=morno`; legenda "Avaliados em dd/mm". `null`: "Sem avaliações de ontem".
  - **Pontos de atenção:** "N conversas sem resposta agora" → `/whatsapp/atendimento`; "N alunos esperando o 1º contato da CS" → `/whatsapp/cs` (omitir se `null`); "N números desconectados" → `/whatsapp/numeros`. Tudo zero: "Nada pedindo atenção agora".
  - "Próximos envios" NÃO entra nesta entrega (chega com os avisos, entrega 7).
- [ ] **Step 2:** typecheck limpo; `npx vitest run src/modulos/whatsapp` passa.
- [ ] **Step 3:** Commit `feat(whatsapp): tela de visão geral`.

### Task 4: Configurações e documentação

**Files:**
- Create: `src/app/(app)/whatsapp/configuracoes/page.tsx`
- Modify: `src/app/(app)/whatsapp/atendimento/page.tsx` (cartão de regras no fim)
- Modify: `docs/modulos/whatsapp.md`

**Interfaces:**
- Consumes: `RegrasAtendimentoForm`, `TextoRegras` (já existem), `obterRegrasAtendimento()`, o componente de `limite-ia.tsx` e os dados que `/admin/saude` passa para ele (copiar a mesma busca), `AbasWhatsapp` com `ativa="configuracoes"`.

- [ ] **Step 1:** Página "Ajustes do WhatsApp" (exige `whatsapp:gerenciar_numeros`) com dois cartões: "Regras de atendimento" (form para admin, texto para os demais — mesma regra de hoje) e "Uso de IA do WhatsApp" (o mesmo componente e a mesma regra de edição que `/admin/saude` usa).
- [ ] **Step 2:** No Atendimento, o cartão de regras vira só `TextoRegras` + link "Alterar em Configurações → Ajustes" (`/whatsapp/configuracoes`) visível para quem tem `whatsapp:gerenciar_numeros`.
- [ ] **Step 3:** `docs/modulos/whatsapp.md`: seção nova "Organização da área" com a árvore de seções/abas e o que cada uma mostra.
- [ ] **Step 4:** typecheck; `npx vitest run` (as 5 falhas de `node-html-parser` já existiam).
- [ ] **Step 5:** Commit `feat(whatsapp): página de ajustes e documentação da nova área`.

## Depois do envio

Nenhum cron, variável ou migration nova. Conferir no site de teste: `/whatsapp` leva à Visão geral (gestão) e a Conversas (vendedor); os cartões batem com Atendimento, Leads e CS.
