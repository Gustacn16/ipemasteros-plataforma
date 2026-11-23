# Venda vira aluno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao registrar uma venda com turma, o aluno entra matriculado no Acadêmico na mesma transação.

**Architecture:** `Matricula.vendaId` liga a matrícula à venda que a criou. O Acadêmico expõe funções internas que recebem a transação (`tx`) do Comercial: lançar, mover e cancelar a matrícula da venda. O formulário de venda ganha o campo Turma, com as turmas abertas de cada produto.

**Tech Stack:** Next.js 16, Prisma 7 + MySQL, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-venda-vira-aluno-design.md`

## Global Constraints
- Turma aberta = situação `planejada` ou `em_andamento`, turma e produto não excluídos.
- Turma obrigatória **só ao criar** a venda, quando o produto tem turma aberta. Na edição é opcional (vendas antigas não são forçadas); se a edição informa turma e a venda não tem matrícula, lança o aluno.
- Só matrícula **criada pela venda** recebe `vendaId`. Se o aluno já estava na turma, não cria nem liga nada (edição/exclusão da venda nunca mexe numa matrícula que não criou).
- Importação do histórico (`importacao-lovable`, `createMany`) não gera alunos.
- Auditoria sem nome nem telefone: `matricula.criada` / `matricula.editada` com `diff: { origem: "venda", ... }`.
- Datas com `paraDia`/`deDia` do Acadêmico. Migração via `prisma migrate diff` a partir do schema em HEAD, timestamp depois de todas as pastas.
- Commits só dos próprios arquivos; avisar a sessão do Comercial antes do push.

## Review Focus
- WhatsApp da venda `62999990000` × telefone do aluno `5562999990000` → mesmo aluno.
- Homônimo com telefone diferente → aluno novo.
- Editar venda para uma turma onde o aluno já está → erro claro, nada muda.
- Excluir venda cujo aluno já estava na turma antes → matrícula intacta.
- Editar venda antiga (sem matrícula) sem escolher turma → salva normalmente.

---

### Task 1: Banco e regra de achar o aluno

**Files:**
- Modify: `prisma/schema.prisma` — `Matricula.vendaId String? @unique @map("venda_id")` + `venda Venda? @relation(fields: [vendaId], references: [id], onDelete: SetNull)`; `Venda.matricula Matricula?`
- Create: migração `prisma/migrations/<ts>_matricula_da_venda/`
- Create: `src/modulos/academico/regras/aluno-da-venda.ts` + `.test.ts`

**Interfaces (Produces):**
```ts
export function mesmoTelefone(a: string | null, b: string | null): boolean; // compara sem o 55 inicial (12–13 dígitos)
export function acharAlunoDaVenda<T extends { id: string; nomeBusca: string; telefone: string | null }>(
  alunos: readonly T[], cliente: { nomeBusca: string; whatsapp: string | null }): T | null;
// 1º quem tem o mesmo telefone; senão mesmo nomeBusca sem telefone diferente; senão null
```
- [ ] Testes: `mesmoTelefone("62999990000","5562999990000")` true; `("62999990000","62888880000")` false; null → false. `acharAlunoDaVenda`: telefone vence nome diferente; homônimo com telefone diferente → null; homônimo sem telefone → ele; cliente sem WhatsApp e homônimo com telefone → ele.
- [ ] Falhar, implementar, passar, `prisma generate`, migração, commit.

### Task 2: Serviço do Acadêmico para vendas

**Files:** Create `src/modulos/academico/servicos/venda-aluno.ts`

**Interfaces (Produces)** — todas recebem `tx` (cliente da transação) e o id do usuário:
```ts
export async function turmasAbertasPorProduto(): Promise<Map<string, { id: string; nome: string }[]>>;
export async function exigirTurmaDaVenda(tx, produtoId: string, turmaId: string | null, opcoes: { criando: boolean; turmaAtualId: string | null }): Promise<void>;
//  criando && produto tem turma aberta && !turmaId → ErroNegocio("Escolha a turma do aluno.")
//  turmaId informado e ≠ turmaAtualId → precisa ser turma aberta DESSE produto, senão ErroNegocio("Turma indisponível para este produto.")
export async function lancarAlunoDaVenda(tx, usuarioId: string, v: { vendaId: string; turmaId: string; nome: string; whatsapp: string | null; dataVenda: string }): Promise<void>;
//  acha (Task 1) ou cria aluno {nome, nomeBusca, telefone: whatsapp}; se já tem matrícula na turma, não faz nada;
//  senão cria matrícula ativa, dataInicio = dataVenda, vendaId. Auditoria aluno.criado (se criou) e matricula.criada {origem:"venda"}.
export async function moverMatriculaDaVenda(tx, usuarioId: string, vendaId: string, turmaId: string): Promise<"movida" | "sem_matricula">;
//  matrícula da venda em outra turma → muda turmaId; P2002 → ErroNegocio("O aluno já está nessa turma.")
export async function cancelarMatriculaDaVenda(tx, usuarioId: string, vendaId: string): Promise<void>;
//  situacao "cancelada", observacoes += "Venda excluída." (linha nova)
```
- [ ] Sem teste de unidade (é banco); coberto por `tsc` e conferência no teste. Commit.

### Task 3: Venda chama o Acadêmico

**Files:** `comercial/esquemas/venda.ts` (+ `turmaId: idOpcional`), `comercial/servicos/vendas.ts`, `comercial/servicos/produtos.ts`, `comercial/componentes/opcoes-venda.ts` (+test), `comercial/componentes/formulario-venda.tsx`, `academico/servicos/alunos.ts`, `academico/componentes/matriculas.tsx`

- [ ] `criarVenda`: depois de criar, `exigirTurmaDaVenda(..., {criando:true, turmaAtualId:null})`; com turma → `lancarAlunoDaVenda`.
- [ ] `editarVenda`: `turmaAtualId` = turma da matrícula da venda; turma informada e diferente → `moverMatriculaDaVenda`; se `"sem_matricula"` → `lancarAlunoDaVenda`. Turma vazia na edição não mexe em nada.
- [ ] `excluirVenda`: `cancelarMatriculaDaVenda`.
- [ ] `selecaoVenda` + `LinhaVenda` ganham `turmaId`/`turmaNome` (da `matricula`); `ProdutoParaVenda` ganha `turmas: {id,nome}[]` (abertas); `opcoesDoFormulario` mantém a turma atual da venda na lista do produto mesmo se não estiver mais aberta (teste novo em `opcoes-venda.test.ts`).
- [ ] Formulário: `Selecao name="turmaId" rotulo="Turma"` logo depois do Produto, visível quando o produto tem turmas; obrigatório quando é venda nova; opção vazia "Sem turma" só na edição; troca de produto limpa a turma. Dica abaixo: "O aluno entra no Acadêmico nesta turma."
- [ ] Ficha do aluno: matrícula com `venda` mostra "Veio da venda de dd/mm/aaaa" (incluir `venda: { select: { dataVenda: true } }` em `obterAluno`).
- [ ] `vitest`, `tsc`, lint, `next build --webpack`. Commit, avisar Comercial, `git fetch`, push `teste`, conferir.
