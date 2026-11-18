# Aniversariantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Data de nascimento em aluno/professor e avisos de aniversário no Acadêmico, no Início e em Minhas tarefas.

**Architecture:** Campo `data_nascimento` (DATE) nas duas tabelas; regra pura em `regras/aniversarios.ts` calcula quem faz aniversário num mês ou numa janela de dias; um serviço lê as pessoas e um componente de servidor desenha o cartão nas três telas.

**Tech Stack:** Next.js 16, Prisma 7 + MySQL, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-aniversariantes-design.md`

## Global Constraints
- Datas só-dia como `"aaaa-mm-dd"`; gravar com `paraDia`, ler com `deDia` (`servicos/acesso.ts`).
- Dia de hoje no fuso de São Paulo: `diaEmSaoPaulo(new Date())` de `@/modulos/tarefas/regras/prazo`.
- Contam: alunos com ao menos uma matrícula `ativa` em turma não excluída; professores com `ativo = true`.
- Cartão de Início/Minhas tarefas só para `temPermissao(papel, "academico:ver")`.
- Importação só preenche `dataNascimento` vazia; nunca sobrescreve.
- Nenhum dado pessoal em URL do próprio app, em log ou em auditoria (auditoria só nomes de campos). O link `https://wa.me/<dígitos>` é clicado pelo usuário.
- Migração via `prisma migrate diff` a partir do schema em HEAD, pasta com timestamp depois de `20261117120000`.
- Só tokens visuais; não editar `src/componentes/*`.

## Review Focus
- Janela de 7 dias que cruza o ano (28/12 → 03/01) mostra aniversários de janeiro.
- 29/02 em ano não bissexto aparece em 28/02 (no mês e na janela).
- Telefone com 10–11 dígitos ganha `55`; já com `55` + 12–13 dígitos fica igual; vazio → sem botão.
- Planilha com "Aniversário" como data do Excel em ano antigo (ex.: 1985) é lida (série < 20000 hoje é recusada por `lerDia`).
- Aluno com matrícula só concluída/cancelada não aparece.

---

### Task 1: Campo data de nascimento

**Files:**
- Modify: `prisma/schema.prisma` (`Aluno`, `Professor`: `dataNascimento DateTime? @map("data_nascimento") @db.Date`)
- Create: `prisma/migrations/20261118010000_academico_nascimento/migration.sql`
- Modify: `src/modulos/academico/esquemas/academico.ts` (`dataNascimento: diaOpcional` em `esquemaAluno` e `esquemaProfessor`)
- Modify: `servicos/alunos.ts`, `servicos/professores.ts` (gravar com `paraDia`, devolver em `obter*` com `deDia`)
- Modify: `componentes/formularios.tsx` (`CampoTexto rotulo="Data de nascimento" name="dataNascimento" type="date"`)
- Modify: fichas `alunos/[id]/page.tsx`, `professores/[id]/page.tsx` se exibirem dados em leitura
- Test: `esquemas/academico.test.ts`

- [ ] Teste: `esquemaAluno.parse({nome:"Ana", dataNascimento:"1990-02-29"})` falha; `"1992-02-29"` passa; vazio → `null`. Igual para professor.
- [ ] Rodar, ver falhar; implementar; rodar `npx vitest run src/modulos/academico` → PASS.
- [ ] Migração: `npx prisma migrate diff --from-schema <(git show HEAD:prisma/schema.prisma) --to-schema prisma/schema.prisma --script` → dois `ALTER TABLE ... ADD COLUMN data_nascimento DATE NULL`.
- [ ] `npx tsc --noEmit` limpo. Commit.

### Task 2: Regra de aniversários

**Files:** Create `src/modulos/academico/regras/aniversarios.ts` + `.test.ts`

**Interfaces (Produces):**
```ts
export type Pessoa = { id: string; nome: string; tipo: "aluno" | "professor"; dataNascimento: string; telefone: string | null };
export type Aniversario = Pessoa & { dia: string /* aaaa-mm-dd no ano do aviso */; hoje: boolean };
export function aniversariantesDoMes(pessoas: Pessoa[], hoje: string): Aniversario[]; // mês de `hoje`, por dia e nome
export function proximosAniversarios(pessoas: Pessoa[], hoje: string, dias: number): Aniversario[]; // de hoje até hoje+dias, inclusive
export function linkWhatsapp(telefone: string | null): string | null;
```

- [ ] Testes: mês de novembro com nascidos 05/11 e 20/11 e 03/12 → só os dois, ordenados; `hoje` marcado. Janela `hoje="2026-12-28"`, 7 dias → inclui 02/01 com `dia:"2027-01-02"`, exclui 05/01. 29/02 com `hoje="2026-02-25"` → `dia:"2026-02-28"`; em 2028 → `"2028-02-29"`. `linkWhatsapp("62999990000")` → `"https://wa.me/5562999990000"`; `"5562999990000"` igual; `null`/`"123"` → `null`.
- [ ] Ver falhar, implementar, ver passar. Commit.

### Task 3: Importar a coluna "Aniversário"

**Files:** `importacao/ler.ts`, `importacao/planejar.ts`, `servicos/importacao.ts`, testes de `ler` e `planejar`

- [ ] `COLUNAS.dataNascimento = ["aniversario", "data de nascimento", "nascimento"]`; `LinhaImportada.dataNascimento: string | null`. Data inválida vira aviso? Não: vira `null` sem erro (não bloqueia importação). Para aceitar anos antigos, ler via nova `lerNascimento(v)` que aceita série Excel ≥ 1 (≥ 1900) além do que `lerDia` aceita.
- [ ] `planejar`: `"dataNascimento"` entra na lista de campos que só completam vazio (junto com telefone e crm); `alunosNovos` e `Existentes.alunos` ganham `dataNascimento`.
- [ ] Serviço: `findMany` seleciona `dataNascimento` (convertido com `deDia`); `create`/`update` gravam com `paraDia`.
- [ ] Testes: cabeçalho "Aniversário" com `new Date("1985-03-10")` → `"1985-03-10"`; série 31116 → `"1985-03-10"`; texto lixo → `null` e sem erro. Planejar: existente com data não é sobrescrito; existente sem data entra em `alunosCompletar`.
- [ ] Ver falhar, implementar, passar. Commit.

### Task 4: Cartões nas três telas

**Files:**
- Create: `servicos/aniversarios.ts` — `listarPessoasComNascimento(ator): Promise<Pessoa[]>` (exige `academico:ver`; filtros dos Global Constraints)
- Create: `componentes/aniversariantes.tsx` (servidor) — `CartaoAniversariantes({ titulo, itens, vazio? })`: linha com nome (link para a ficha), dia `dd/mm`, chip aluno/professor, destaque se `hoje`, botão WhatsApp (`target="_blank" rel="noopener noreferrer"`) quando `linkWhatsapp` não é nulo. Sem itens e sem `vazio` → não renderiza.
- Modify: `src/app/(app)/academico/page.tsx` — no topo, "Aniversariantes de <mês por extenso>", com texto vazio "Ninguém faz aniversário este mês (ou falta a data de nascimento)." Também no estado sem turmas.
- Modify: `src/app/(app)/inicio/page.tsx` e `src/app/(app)/tarefas/minhas/page.tsx` — "Aniversários dos próximos 7 dias", só com `academico:ver`, sem estado vazio.
- [ ] Build `npx next build --webpack` limpo; `npx vitest run` verde; lint. Commit, `git fetch`, push `teste`, conferir no teste.
