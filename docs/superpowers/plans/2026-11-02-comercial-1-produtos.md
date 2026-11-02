# Comercial — Entrega 1 (Produtos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o papel `comercial`, as permissões do módulo, o catálogo único de produtos (com ofertas e links), a lista de canais de venda, a importação dos 12 produtos atuais e o item **Comercial** no menu.

**Architecture:** Novo módulo `src/modulos/comercial/` no padrão dos módulos existentes (`esquemas`, `regras`, `servicos` com `import "server-only"`, `acoes` com `"use server"`, `componentes`). Rotas em `src/app/(app)/comercial/`. Uma migration de estrutura e uma migration de dados (gerada por script a partir de um arquivo TypeScript tipado e testado).

**Tech Stack:** Next.js 16.4.3 (App Router, `--webpack`), TypeScript strict, Prisma 7 + MySQL, Zod 4, Vitest, shadcn em `src/componentes/ui`, `tsx` (já em devDependencies).

**Spec:** `docs/superpowers/specs/2026-11-02-comercial-design.md` (seções 3, 4, 5.3–5.4, 6, 7, 9 e 10.1). As entregas 2–4 terão planos próprios.

## Global Constraints

- Tudo em português: código de domínio, interface, mensagens, docs e commits (Conventional Commits, ex.: `feat(comercial): ...`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Arquivos `kebab-case`, componentes `PascalCase`, funções `camelCase`, tabelas `snake_case` no plural via `@@map`, colunas `snake_case` via `@map`.
- Ids `cuid`; `criadoEm`/`atualizadoEm`; exclusão lógica com `excluidoEm`.
- Dinheiro em `Decimal(12,2)`. `Decimal` não atravessa para componentes de cliente: serializar como string `"1234.56"`.
- Toda Server Action valida com Zod e checa permissão no servidor (`exigirPermissao`). Registro fora do alcance responde "Não encontrado.".
- Não há banco local: migrations são geradas com `prisma migrate diff`, nunca com `migrate dev`. Nunca `db push`.
- Verificação: `npm run typecheck`, `npm run test`, `npx eslint <arquivos>`, `npx next build --webpack` (`npm run build` falha localmente porque roda migrate).
- Outras sessões podem estar trabalhando na mesma pasta: commitar só os próprios arquivos com `git commit -m "..." -- <arquivos>`, nunca `git add -A`, stash, reset ou troca de branch. Antes de alterar `prisma/schema.prisma`, confirmar com `git status --short prisma/` que não há alteração não commitada de outra sessão; se houver, parar e avisar.
- Branch `teste`. Push com `git fetch origin teste` e só se `git log HEAD..origin/teste` estiver vazio (senão `git pull --rebase origin teste` quando a árvore estiver limpa).

## Review Focus

1. Valor digitado no formato brasileiro ("3.300,00", "R$ 1.000", "11264") vira o decimal certo, e lixo ("abc", "1,2,3") é recusado — Task 3, testes de `lerReais`.
2. SKU repetido com espaços ou minúsculas ("pg001tct ") é tratado como o mesmo SKU — Task 4 (normalização no esquema) e Task 5 (checagem no serviço).
3. Marcar uma segunda oferta como padrão deixa só ela como padrão — Task 5 (transação no serviço) e teste da regra `ajustarPadrao` na Task 4.
4. Usuário `comercial` chamando uma ação de escrita de produto diretamente recebe "sem permissão" — Task 1 (matriz) e Task 6 (todas as ações de escrita exigem `comercial:gerenciar_produtos`).
5. Rodar a migration do catálogo de novo, ou com texto contendo aspas e quebras de linha (ementas), não duplica nem quebra o SQL — Task 8, testes de `sqlTexto` e do gerador.

---

### Task 1: Papel `comercial` e permissões

**Files:**
- Modify: `src/lib/permissoes.ts`
- Test: `src/lib/permissoes.test.ts`

**Interfaces:**
- Produces: `Papel` inclui `"comercial"`; `ROTULO_PAPEL.comercial = "Comercial"`; permissões `"comercial:ver" | "comercial:registrar_venda" | "comercial:ver_equipe" | "comercial:gerenciar_vendas" | "comercial:gerenciar_metas" | "comercial:gerenciar_produtos"`.

- [ ] **Step 1: Write the failing tests** (novo `describe("permissões do Comercial")`)

```ts
it("admin e gestor têm todas as permissões do Comercial", () => {
  for (const papel of ["admin", "gestor"] as const)
    for (const p of ["comercial:ver", "comercial:registrar_venda", "comercial:ver_equipe", "comercial:gerenciar_vendas", "comercial:gerenciar_metas", "comercial:gerenciar_produtos"] as const)
      expect(temPermissao(papel, p)).toBe(true);
});
it("comercial vê o módulo e registra venda, mas não gerencia nem vê a equipe", () => {
  expect(temPermissao("comercial", "comercial:ver")).toBe(true);
  expect(temPermissao("comercial", "comercial:registrar_venda")).toBe(true);
  for (const p of ["comercial:ver_equipe", "comercial:gerenciar_vendas", "comercial:gerenciar_metas", "comercial:gerenciar_produtos"] as const)
    expect(temPermissao("comercial", p)).toBe(false);
});
it("comercial tem as mesmas permissões de tarefas, conteúdo e agenda do colaborador", () => {
  for (const p of ["tarefas:usar", "tarefas:gerenciar_listas", "conteudo:usar", "agenda:usar", "agenda:ver_institucional", "agenda:editar_institucional"] as const)
    expect(temPermissao("comercial", p)).toBe(temPermissao("colaborador", p));
});
it("colaborador, professor e aluno não entram no Comercial", () => {
  for (const papel of ["colaborador", "professor", "aluno"] as const) expect(temPermissao(papel, "comercial:ver")).toBe(false);
});
it("admin e gestor convidam comercial", () => {
  expect(podeConvidar("admin", "comercial")).toBe(true);
  expect(podeConvidar("gestor", "comercial")).toBe(true);
  expect(podeConvidar("comercial", "colaborador")).toBe(false);
});
```

Ajustar o teste existente `papeisConvidaveis("gestor")` para `["colaborador", "comercial", "professor"]`.

- [ ] **Step 2: Run** `npx vitest run src/lib/permissoes.test.ts` — Expected: FAIL (tipos e papel inexistentes).

- [ ] **Step 3: Implement in `src/lib/permissoes.ts`**: `PAPEIS = ["admin", "gestor", "colaborador", "comercial", "professor", "aluno"]`; constante `COMERCIAL_GESTAO` com as 6 permissões, somada a admin e gestor; `comercial` = lista do colaborador + `"comercial:ver"`, `"comercial:registrar_venda"` (extrair a lista do colaborador numa constante `PERMISSOES_COLABORADOR` para não duplicar); `PAPEIS_CONVIDAVEIS`: admin `["admin", "gestor", "colaborador", "comercial", "professor"]`, gestor `["colaborador", "comercial", "professor"]`, `comercial: []`.

- [ ] **Step 4: Run** `npx vitest run src/lib/permissoes.test.ts` — Expected: PASS. Rodar `npm run typecheck` e corrigir todo `Record<Papel, …>` que reclamar (ex.: rótulos em telas de admin).

- [ ] **Step 5: Commit** — `feat(comercial): papel comercial e permissões do módulo` (só os arquivos alterados nesta task).

---

### Task 2: Modelos e migration de estrutura

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261103020000_comercial_produtos/migration.sql` (se já existir migration com timestamp maior em `prisma/migrations/`, use um timestamp posterior a ela)

**Interfaces:**
- Produces (Prisma): `prisma.produto`, `prisma.ofertaProduto`, `prisma.linkProduto`, `prisma.canalVenda`; enums `TipoProduto { curso_livre paciente_modelo pos_graduacao }`, `TipoComissao { valor percentual }`, `CategoriaLink { vendas aulas outro }`; `Papel` ganha `comercial`.

- [ ] **Step 1: Confirm** `git status --short prisma/` está vazio. Se não, parar e avisar.

- [ ] **Step 2: Add models** exatamente com os campos da spec, seção 4 (`Produto`, `OfertaProduto`, `LinkProduto`, `CanalVenda`), tabelas `produtos`, `ofertas_produto`, `links_produto`, `canais_venda`. Detalhes:
  - `Produto`: `nome VarChar(150)`, `area VarChar(80)?`, `sku VarChar(60)?` com `@@index([sku])` (unicidade entre não excluídos é checada no serviço), cargas `Int?`, `comissaoTipo TipoComissao @default(valor)`, `comissaoBase`/`comissaoBonus Decimal(12,2) @default(0)`, textos longos `@db.Text`, `@@index([tipo, ativo])`.
  - `OfertaProduto`: `formasPagamento Json` (lista de strings), `descontoPontualidadePct Decimal(5,2) @default(0)`, `parcelas Int @default(0)`, `ordem Int`, `onDelete: Cascade` para o produto, `@@index([produtoId])`.
  - `LinkProduto`: `url VarChar(500)`, `ordem Int`, `onDelete: Cascade`.
  - `CanalVenda`: `nome VarChar(60) @unique`, `ativo Boolean @default(true)`, `ordem Int`.

- [ ] **Step 3: Generate the migration SQL**

```bash
git show HEAD:prisma/schema.prisma > "$TMPDIR/schema-anterior.prisma"
npx prisma migrate diff --from-schema "$TMPDIR/schema-anterior.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20261103020000_comercial_produtos/migration.sql
```

(Confirmar as flags com `npx prisma migrate diff --help` se o Prisma reclamar.) Expected: arquivo com `CREATE TABLE produtos ...`, as outras 3 tabelas e `ALTER TABLE usuarios MODIFY papel ENUM(... 'comercial' ...)`. Conferir também a tabela `convites`, se ela usar o enum `Papel`.

- [ ] **Step 4: Run** `npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** — `feat(comercial): modelos de produto, oferta, link e canal` (`schema.prisma` + a pasta da migration).

---

### Task 3: Dinheiro em reais

**Files:**
- Create: `src/lib/dinheiro.ts`
- Test: `src/lib/dinheiro.test.ts`

**Interfaces:**
- Produces: `lerReais(texto: string): string | null` (string decimal com 2 casas, ex. `"3300.00"`, ou `null` se inválido); `formatarReais(valor: string | number): string` (ex. `"R$ 3.300,00"`, fuso irrelevante, `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`).

- [ ] **Step 1: Write the failing tests**

```ts
it.each([["3.300,00", "3300.00"], ["R$ 1.000", "1000.00"], ["11264", "11264.00"], ["1234,5", "1234.50"], ["1234.56", "1234.56"], ["0", "0.00"], ["  R$ 20.000,00 ", "20000.00"]])("lerReais(%s) = %s", (e, s) => expect(lerReais(e)).toBe(s));
it.each(["", "abc", "1,2,3", "-5", "1.2.3,4,5", "12,345"])("lerReais(%s) é inválido", (e) => expect(lerReais(e)).toBeNull());
it("formatarReais", () => { expect(formatarReais("3300.00")).toBe("R$ 3.300,00"); expect(formatarReais(0)).toBe("R$ 0,00"); });
```

Regra que os testes fixam: vírgula é o separador decimal (no máximo 2 casas); ponto seguido de exatamente 3 dígitos é separador de milhar; ponto seguido de 1 ou 2 dígitos no fim é decimal. Negativos não são aceitos. `formatarReais` usa espaço comum no resultado (trocar o ` ` do `Intl`).

- [ ] **Step 2: Run** `npx vitest run src/lib/dinheiro.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lerReais` e `formatarReais`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(core): leitura e formatação de valores em reais`.

---

### Task 4: Esquemas e regras de produto

**Files:**
- Create: `src/modulos/comercial/esquemas/produto.ts`, `src/modulos/comercial/regras/produto.ts`
- Test: `src/modulos/comercial/esquemas/produto.test.ts`, `src/modulos/comercial/regras/produto.test.ts`

**Interfaces:**
- Consumes: `lerReais` (Task 3).
- Produces:
  - Constantes com rótulos: `TIPOS_PRODUTO` + `ROTULO_TIPO_PRODUTO` ("Curso Livre", "Paciente Modelo", "Pós-Graduação"); `FORMAS_PAGAMENTO = ["pix", "cartao", "boleto", "transferencia"]` + `ROTULO_FORMA_PAGAMENTO` ("Pix", "Cartão", "Boleto", "Transferência"); `TIPOS_COMISSAO` + rótulos ("R$", "%"); `CATEGORIAS_LINK` + rótulos ("Vendas", "Aulas", "Outro").
  - `esquemaProduto`, `esquemaOferta`, `esquemaLink`, `esquemaCanal` (Zod) e os tipos `DadosProduto`, `DadosOferta`, `DadosLink`, `DadosCanal`. Os campos chegam como strings de formulário. Valores em reais usam `z.string().transform(lerReais)` com erro "Valor inválido" quando `null`; campos vazios opcionais viram `null`.
  - `esquemaFiltrosProdutos` (URL): `tipo` (enum, `.catch(undefined)`), `area?`, `situacao` (`"ativos" | "inativos" | "todos"`, `.catch("ativos")`).
  - Regras: `cargaTotal(p: { cargaTeoricaPresencial: number | null; cargaTeoricaSincrona: number | null; cargaTeoricaAssincrona: number | null; cargaPratica: number | null; cargaExtra: number | null }): number | null` (soma, `null` se todas forem nulas); `podeExcluirProduto(usos: { vendas: number; metas: number }): boolean`; `ajustarPadrao<T extends { id: string; padrao: boolean }>(ofertas: T[], idPadrao: string): T[]` (deixa só `idPadrao` como padrão).

- [ ] **Step 1: Write the failing tests**
  - `esquemaProduto`: SKU `" pg001tct "` → `"PG001TCT"`; SKU vazio → `null`; nome com 1 caractere recusado; `comissaoTipo: "percentual"` com `comissaoBase: "150"` recusado ("Percentual deve ser até 100"); cargas negativas recusadas; `duracaoMeses: ""` → `null`.
  - `esquemaOferta`: `precoCheio: "3.300,00"` → `"3300.00"`; `parcelas: "0"` aceito (à vista), `"61"` recusado; `descontoPontualidadePct: "101"` recusado; `formasPagamento: ["pix", "cartao"]` aceito, `["dinheiro"]` recusado; `link: "javascript:alert(1)"` recusado, `"https://canva.link/x"` aceito.
  - `esquemaLink`: URL obrigatória http(s); título obrigatório.
  - `esquemaFiltrosProdutos.parse({})` → `{ situacao: "ativos" }`.
  - Regras: `cargaTotal` de 8+36 → 44, todas nulas → `null`; `podeExcluirProduto({ vendas: 0, metas: 0 })` true, com 1 venda false, com 1 meta false; `ajustarPadrao` com duas padrão → só a escolhida fica `true`.
- [ ] **Step 2: Run** `npx vitest run src/modulos/comercial` — Expected: FAIL.
- [ ] **Step 3: Implement** esquemas e regras.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(comercial): esquemas e regras de produto`.

---

### Task 5: Serviços de produtos e canais

**Files:**
- Create: `src/modulos/comercial/servicos/acesso.ts`, `src/modulos/comercial/servicos/produtos.ts`, `src/modulos/comercial/servicos/canais.ts`

**Interfaces:**
- Consumes: esquemas e regras (Task 4); `UsuarioAtual`, `ErroNegocio`, `ErroPermissao`, `temPermissao`.
- Produces:
  - `acesso.ts`: `MENSAGEM_NAO_ENCONTRADO = "Não encontrado."`; `exigirPermissaoComercial(ator: UsuarioAtual, permissao: Permissao): void`.
  - `produtos.ts` (todas exigem `comercial:ver` para ler e `comercial:gerenciar_produtos` para escrever):
    - `listarProdutos(ator, filtros: FiltrosProdutos)` → produtos não excluídos, ordenados por tipo e nome, com `ofertaPadrao` (preço cheio) e contagem de ofertas, valores serializados.
    - `listarProdutosAtivos()` → `{ id, nome, tipo }[]` para os campos de escolha das entregas 2 e 3 (ativos e não excluídos).
    - `obterProduto(ator, id)` → produto com ofertas e links ordenados, valores serializados; lança `ErroNegocio(MENSAGEM_NAO_ENCONTRADO)` se excluído ou inexistente.
    - `criarProduto(ator, dados: DadosProduto): Promise<{ id: string }>`, `editarProduto(ator, id, dados)`, `definirAtivoProduto(ator, id, ativo: boolean)`, `excluirProduto(ator, id)`.
    - `salvarOferta(ator, produtoId, dados: DadosOferta & { id?: string })`, `excluirOferta(ator, ofertaId)`, `salvarLink(ator, produtoId, dados: DadosLink & { id?: string })`, `excluirLink(ator, linkId)`.
  - `canais.ts`: `listarCanais(opcoes?: { soAtivos?: boolean })`, `salvarCanal(ator, dados: DadosCanal & { id?: string })`, `definirAtivoCanal(ator, id, ativo)`.
- Regras implementadas aqui:
  - SKU único entre não excluídos: `ErroNegocio("Já existe um produto com este SKU.")`.
  - Oferta com `padrao: true` desmarca as outras do mesmo produto na mesma transação. A primeira oferta de um produto vira padrão automaticamente.
  - `excluirProduto` chama `podeExcluirProduto({ vendas: 0, metas: 0 })`, com o comentário `// Vendas e metas entram nas entregas 2 e 3, que passam a contar aqui.`. Quando a regra recusar: `ErroNegocio("Este produto tem vendas ou metas. Desative em vez de excluir.")`. A exclusão grava `excluidoEm`.
  - Nova oferta ou link recebe `ordem = maior + 1`.
  - Nome de canal repetido: `ErroNegocio("Já existe um canal com este nome.")`.

- [ ] **Step 1: Implement** os três arquivos, seguindo o padrão de `src/modulos/tarefas/servicos/espacos.ts` (`import "server-only"`, checagem de permissão no início de cada função).
- [ ] **Step 2: Run** `npm run typecheck` — Expected: PASS.
- [ ] **Step 3: Commit** — `feat(comercial): serviços de produtos, ofertas, links e canais`.

---

### Task 6: Server Actions

**Files:**
- Create: `src/modulos/comercial/acoes/produtos.ts`, `src/modulos/comercial/acoes/canais.ts`

**Interfaces:**
- Consumes: serviços (Task 5), `dadosDoFormulario`, `tratarErroAcao`, `EstadoAcao` de `@/lib/acoes`, `exigirPermissao` de `@/lib/sessao`.
- Produces: `criarProdutoAcao(_: EstadoAcao<{ id: string }>, formData): Promise<EstadoAcao<{ id: string }>>`, `editarProdutoAcao(_, formData)`, `definirAtivoProdutoAcao(id: string, ativo: boolean)`, `excluirProdutoAcao(id: string)`, `salvarOfertaAcao(_, formData)`, `excluirOfertaAcao(id)`, `salvarLinkAcao(_, formData)`, `excluirLinkAcao(id)`, `salvarCanalAcao(_, formData)`, `definirAtivoCanalAcao(id, ativo)`.

- [ ] **Step 1: Implement** no padrão de `src/modulos/tarefas/acoes/estrutura.ts`: toda ação começa com `exigirPermissao("comercial:gerenciar_produtos")`, faz o parse com o esquema da Task 4 e termina com `revalidatePath("/comercial", "layout")`. `formasPagamento` vem de `formData.getAll("formasPagamento")`, porque `dadosDoFormulario` só guarda o último valor. Mensagens: "Produto criado.", "Produto atualizado.", "Produto ativado." / "Produto desativado.", "Produto excluído.", "Oferta salva.", "Oferta excluída.", "Link salvo.", "Link excluído.", "Canal salvo.".
- [ ] **Step 2: Run** `npm run typecheck` e `npx eslint src/modulos/comercial` — Expected: PASS, sem avisos.
- [ ] **Step 3: Commit** — `feat(comercial): ações de produtos e canais`.

---

### Task 7: Telas de Produtos e Canais, e item no menu

**Files:**
- Create: `src/app/(app)/comercial/layout.tsx`, `src/app/(app)/comercial/page.tsx`, `src/app/(app)/comercial/produtos/page.tsx`, `src/app/(app)/comercial/produtos/[id]/page.tsx`, `src/app/(app)/comercial/canais/page.tsx`
- Create: `src/modulos/comercial/componentes/abas-comercial.tsx`, `formulario-produto.tsx`, `ofertas-produto.tsx`, `links-produto.tsx`, `novo-produto.tsx`, `canais-venda.tsx`, `exibicao.tsx`
- Modify: `src/app/(app)/layout.tsx`, `src/app/(app)/menu-navegacao.tsx`

**Interfaces:**
- Consumes: serviços (Task 5), ações (Task 6), rótulos (Task 4), `formatarReais` (Task 3).

- [ ] **Step 1: Menu principal**: em `menu-navegacao.tsx`, ícone `comercial: <BriefcaseBusinessIcon />` no lugar de `dashboard` (se o ícone não existir no `lucide-react` instalado, usar `HandCoinsIcon`). Em `layout.tsx`, remover o item futuro "Dashboard" e adicionar `{ href: "/comercial", rotulo: "Comercial", icone: "comercial" }` quando `temPermissao(usuario.papel, "comercial:ver")`, depois de Agenda.
- [ ] **Step 2: Layout do módulo**: `exigirPermissaoPagina("comercial:ver")`, título "Comercial" e `AbasComercial` (cliente, destaca a aba atual com `usePathname`). Abas: "Produtos" (`/comercial/produtos`) e "Canais" (`/comercial/canais`, só para quem tem `comercial:gerenciar_produtos`). Dashboard, Vendas e Metas entram nas próximas entregas. `/comercial/page.tsx` faz `redirect("/comercial/produtos")`.
- [ ] **Step 3: Lista `/comercial/produtos`**: filtros na URL (tipo, área e situação, com padrão "ativos") no padrão de `filtros-lista.tsx` do Tarefas; grupos por tipo com nome, área, SKU, preço cheio da oferta padrão (`formatarReais`) e selo "Inativo". Botão "+ Novo produto" (diálogo com nome e tipo, que leva ao detalhe ao criar) só com `comercial:gerenciar_produtos`. Vazio: "Nenhum produto neste filtro.".
- [ ] **Step 4: Detalhe `/comercial/produtos/[id]`**: `ErroNegocio` vira `notFound()` (mesmo `ou404` de `tarefas/listas/[listaId]/page.tsx`). Seções em `Card`: Dados gerais, Carga horária (mostra a total de `cargaTotal`), Comissão, Ofertas (tabela com nome, padrão, preço cheio, matrícula, parcelas × valor, desconto, formas e link; adicionar, editar e excluir em diálogo; formas de pagamento como checkboxes), Links (agrupados por categoria e abrindo em nova aba com `rel="noopener noreferrer"`), Descrição, Ementa e Observações (texto com quebras de linha preservadas, `whitespace-pre-line`). Ações no topo: "Desativar"/"Ativar" e "Excluir" (com `confirm`; se recusado, mostra a mensagem do servidor com `toast`). Sem `comercial:gerenciar_produtos`, tudo só leitura e sem botões.
- [ ] **Step 5: Canais `/comercial/canais`**: exige `comercial:gerenciar_produtos` (`exigirPermissaoPagina`); lista com nome, ativo (chave liga/desliga) e campo para adicionar.
- [ ] **Step 6: Run** `npm run typecheck`, `npx eslint "src/app/(app)/comercial" src/modulos/comercial "src/app/(app)/layout.tsx" "src/app/(app)/menu-navegacao.tsx"` e `npx next build --webpack` — Expected: PASS; o build lista `/comercial`, `/comercial/produtos`, `/comercial/produtos/[id]` e `/comercial/canais`.
- [ ] **Step 7: Commit** — `feat(comercial): telas de produtos e canais e item no menu`.

---

### Task 8: Importação do catálogo (migration de dados)

**Files:**
- Create: `src/modulos/comercial/dados/catalogo-produtos.ts`, `src/modulos/comercial/dados/sql-catalogo.ts`, `scripts/gerar-sql-catalogo.ts`
- Create: `prisma/migrations/20261103030000_comercial_catalogo/migration.sql` (timestamp posterior ao da Task 2)
- Test: `src/modulos/comercial/dados/catalogo-produtos.test.ts`, `src/modulos/comercial/dados/sql-catalogo.test.ts`

**Interfaces:**
- Consumes: `esquemaProduto`, `esquemaOferta`, `esquemaLink` (Task 4).
- Produces: `CATALOGO_PRODUTOS: ProdutoCatalogo[]` (cada um com `id` fixo `"prod_<slug>"`, campos do `Produto`, `ofertas[]` com `id` `"ofer_<slug>_<n>"` e `links[]` com `id` `"link_<slug>_<n>"`; valores em reais como string `"3300.00"`); `CANAIS_INICIAIS = ["Instagram", "Indicação", "Google", "WhatsApp", "Evento", "Outro"]`; `sqlTexto(v: string | null): string` (`NULL` ou `'...'` com `\` e `'` escapados); `gerarSqlCatalogo(): string`.

- [ ] **Step 1: Transcrever** os 12 produtos de `/Users/gustavocaixeta/Downloads/produtos-ipemaster.md` para `catalogo-produtos.ts`, com relative imports (o script roda fora do Next). Regras de transcrição:
  - `comissaoTipo: "percentual"` nas duas Psiquiatrias (1.25/2.5 e 2/4); demais `"valor"`.
  - "Á vista" vira "À vista".
  - Oferta "(padrão)" → `padrao: true`, com o sufixo removido do nome.
  - "Transplante de Barba" fica sem ofertas.
  - "Grupo de funil" da Psiquiatria Híbrido vai em `observacoes` ("Compartilha investimento e leads com a Pós-Graduação em Psiquiatria EAD.").
  - Datas e textos da ementa entram como estão.
  - Pagamento "—" vira lista vazia; links sem título usam o próprio rótulo do arquivo.
- [ ] **Step 2: Write the failing tests**
  - `catalogo-produtos.test.ts`: 12 produtos; ids únicos; cada produto passa em `esquemaProduto`, cada oferta em `esquemaOferta`, cada link em `esquemaLink` (convertendo para o formato de formulário); todo produto com ofertas tem exatamente uma padrão; SKUs não nulos são únicos; "Pós-Graduação em Psiquiatria EAD" tem `comissaoTipo: "percentual"`, `comissaoBase: "2.00"`.
  - `sql-catalogo.test.ts`: `sqlTexto(null)` → `NULL`; `sqlTexto("D'Ávila \\ x")` → `'D\'Ávila \\\\ x'`; `gerarSqlCatalogo()` só usa `INSERT IGNORE INTO` (nenhum `INSERT INTO` sem `IGNORE`), contém os 12 ids de produto e as 6 linhas de canais, e é determinístico (duas chamadas iguais).
- [ ] **Step 3: Run** `npx vitest run src/modulos/comercial/dados` — Expected: FAIL.
- [ ] **Step 4: Implement** `sql-catalogo.ts` (gera `INSERT IGNORE` com colunas explícitas no nome `snake_case` da Task 2, `criado_em`/`atualizado_em` = `CURRENT_TIMESTAMP(3)`, `formas_pagamento` como JSON) e `scripts/gerar-sql-catalogo.ts`, que grava o resultado no arquivo `migration.sql`.
- [ ] **Step 5: Run** `npx tsx scripts/gerar-sql-catalogo.ts` e depois `npx vitest run src/modulos/comercial/dados` — Expected: PASS, com o `migration.sql` gerado. Conferir à mão 2 produtos no SQL contra o arquivo original.
- [ ] **Step 6: Commit** — `feat(comercial): importação dos 12 produtos do catálogo atual`.

---

### Task 9: Documentação, verificação e publicação

**Files:**
- Create: `docs/modulos/comercial.md`
- Modify: `docs/modulos/dashboard.md` (vira uma nota curta apontando para `comercial.md` e a spec), `docs/modulos/academico.md` (o `Curso` passa a ser o `Produto` do Comercial), `docs/01-visao-geral.md` (tabela de módulos e roadmap: "F6 — Comercial"), `docs/04-seguranca-permissoes.md` (papel `comercial` e as 6 permissões), `docs/03-modelo-de-dados.md` (entidades do Comercial)

- [ ] **Step 1: Write** `docs/modulos/comercial.md` no formato de `docs/modulos/tarefas.md` (objetivo, entidades, telas, regras e situação: "Entrega 1 (feito): produtos e canais. Próximas: vendas, metas e dashboard; depois Kommo, parcelas/MRR e comissão").
- [ ] **Step 2: Run** `npm run typecheck && npm run test`, `npx eslint` nos arquivos alterados e `npx next build --webpack` — Expected: tudo PASS.
- [ ] **Step 3: Commit** — `docs(comercial): documentação do módulo e do papel comercial`.
- [ ] **Step 4: Push** para `origin teste` (regras de push em Global Constraints).
- [ ] **Step 5: Acompanhar o deploy** com o conector Hostinger: `hosting_get-deployment` com domínio `teste.plataformaipemaster.com.br`, até o log mostrar "Application restarted" e, na etapa `prisma migrate deploy`, as 2 migrations novas aplicadas (se o build falhar, ler a análise de falha do próprio retorno e corrigir antes de seguir). Depois, `curl -s -o /dev/null -w "%{http_code}" https://teste.plataformaipemaster.com.br/comercial` deve responder `307` (login).
- [ ] **Step 6: Entregar ao usuário** um roteiro de teste, um passo por vez, em português simples: entrar como admin → menu Comercial → conferir os 12 produtos → abrir a Pós Transplante Capilar e conferir as 2 ofertas → criar uma oferta de teste e marcá-la como padrão → desativar e reativar um produto → tentar excluir um produto (deve funcionar nesta entrega, já que ainda não há vendas) → convidar um usuário com o papel Comercial e conferir que ele vê os produtos, mas sem botões de edição.
