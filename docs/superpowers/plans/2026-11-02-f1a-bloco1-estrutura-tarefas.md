# F1a Bloco 1 — Estrutura e tarefas: plano de implementação

> **Para agentes:** executar tarefa a tarefa (superpowers:executing-plans). Passos com checkbox (`- [ ]`).

**Objetivo:** espaços (departamentos), listas com status, tarefas com subtarefas, responsáveis, datas e prioridade, visualização Lista, detalhe da tarefa e Minhas tarefas, publicados em `teste`.

**Arquitetura:** módulo `src/modulos/tarefas/` no padrão do Core (`regras/` puras e testadas, `servicos/` com Prisma e checagem de acesso por registro, `acoes/` Server Actions finas, `esquemas/` Zod, `componentes/`). Rotas em `src/app/(app)/tarefas/`.

**Stack:** Next.js 16 App Router, Prisma 7 + MySQL, Zod 4, Vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-02-f1a-tarefas-design.md`

## Restrições globais
- Tudo em português (código de domínio, interface, docs). Arquivos `kebab-case`, tabelas `snake_case` plural via `@@map`, ids `cuid`, `criadoEm`/`atualizadoEm`, exclusão lógica `excluidoEm`.
- Datas em UTC; dias (hoje, atraso) calculados em `America/Sao_Paulo` (`FUSO_PADRAO` de `src/lib/datas.ts`).
- Permissão checada no servidor em toda Server Action; acesso negado a registro responde como não encontrado (`ErroNegocio("Não encontrado.")`).
- Sem banco local: a migration é gerada com `prisma migrate diff` a partir do schema do último commit; serviços com Prisma são validados na homologação.
- Histórico de alterações, Kanban, checklist, etiquetas e ordem fracionária ficam no bloco 2. Neste bloco, nova tarefa recebe `ordem = maior ordem da lista + 1`.

## Foco de revisão
1. Colaborador abrindo URL de lista/tarefa de espaço em que não é membro → "não encontrado", nunca os dados.
2. Professor abrindo `/tarefas/listas/...` → redireciona para Minhas tarefas.
3. Excluir o último status `aberto` ou `concluido` de uma lista → recusado com mensagem clara.
4. Data de início depois da entrega → erro no campo, nada gravado.
5. Tarefa com entrega "hoje" às 22h de Brasília (já 01h UTC do dia seguinte) → continua em "Hoje", não em "Atrasadas".

---

### Tarefa 1: Regras puras
**Arquivos:** `src/modulos/tarefas/regras/status.ts`, `regras/prazo.ts`, testes `*.test.ts` ao lado.

**Produz:**
- `STATUS_PADRAO: readonly { nome: string; cor: string; tipo: TipoStatus }[]` (*A fazer*/aberto, *Em andamento*/em_andamento, *Concluído*/concluido).
- `type TipoStatus = "aberto" | "em_andamento" | "concluido"`.
- `validarConjuntoStatus(tipos: TipoStatus[]): string | null` — mensagem de erro se faltar `aberto` ou `concluido`.
- `concluidaEmAoMudarStatus(tipoNovo: TipoStatus, concluidaEmAtual: Date | null, agora: Date): Date | null` (regra 4).
- `diaEmSaoPaulo(data: Date): string` ("AAAA-MM-DD") e `diaDaDataEntrega(data: Date): string` (a data `@db.Date` vem como meia-noite UTC).
- `type GrupoMinhas = "atrasadas" | "hoje" | "proximos7" | "depois" | "sem_data"`; `grupoDaEntrega(dataEntrega: Date | null, agora: Date): GrupoMinhas`.
- `datasValidas(inicio: Date | null, entrega: Date | null): boolean` (regra 10).

- [ ] Testes: status padrão tem os 3 tipos; `validarConjuntoStatus(["aberto","em_andamento"])` retorna mensagem; `concluidaEmAoMudarStatus` grava/limpa/preserva; `grupoDaEntrega` com agora = 2026-11-28T01:00Z (22h de 27/11 em SP) e entrega 27/11 → "hoje"; entrega 26/11 → "atrasadas"; entrega 04/12 → "proximos7"; entrega 05/12 → "depois"; `null` → "sem_data".
- [ ] Rodar `npx vitest run src/modulos/tarefas` → falha; implementar; rodar → passa; commit.

### Tarefa 2: Modelos e migration
**Arquivos:** `prisma/schema.prisma`, `prisma/migrations/20261102000000_tarefas_estrutura/migration.sql`.

Modelos da spec §4 deste bloco: `Espaco`, `MembroEspaco`, `Lista`, `StatusLista`, `Tarefa`, `TarefaResponsavel` e os enums `TipoStatus`, `PrioridadeTarefa`. `ordem` como `Decimal(20,10)`; `dataInicio`/`dataEntrega` como `@db.Date`; relações inversas em `Usuario`.

- [ ] Editar schema; `npx prisma validate`.
- [ ] Gerar SQL: `git show HEAD:prisma/schema.prisma > /tmp/anterior.prisma` (scratchpad) e `npx prisma migrate diff --from-schema <anterior> --to-schema prisma/schema.prisma --script`.
- [ ] Conferir que o SQL só cria tabelas novas e adiciona FKs; `npm run typecheck`; commit.

### Tarefa 3: Permissões e acesso
**Arquivos:** `src/lib/permissoes.ts` (+ teste), `src/modulos/tarefas/servicos/acesso.ts`.

**Produz:** permissões `tarefas:gerenciar_espacos`, `tarefas:gerenciar_listas`, `tarefas:ver_todos_espacos`, `tarefas:usar`, `tarefas:ver_relatorio_equipe` com a matriz da spec §6. Em `acesso.ts`:
- `filtroEspacosVisiveis(ator): Prisma.EspacoWhereInput`
- `exigirEspaco(ator, espacoId)`, `exigirLista(ator, listaId)`, `exigirTarefa(ator, tarefaId)` → registro ou `ErroNegocio("Não encontrado.")`; professor só passa em `exigirTarefa` quando é responsável.
- `podeExcluirTarefa(ator, tarefa: { criadoPorId: string }): boolean`.

- [ ] Teste da matriz no `permissoes.test.ts` (professor tem só `tarefas:usar`; colaborador não tem `gerenciar_espacos` nem `ver_todos_espacos`).
- [ ] Implementar; `npx vitest run`; commit.

### Tarefa 4: Espaços, membros, listas e status
**Arquivos:** `esquemas/estrutura.ts` (+ teste), `servicos/espacos.ts`, `servicos/listas.ts`, `acoes/estrutura.ts`; auditoria `espaco.criado`, `espaco.excluido`, `espaco.membros_alterados` em `src/lib/auditoria.ts`.

**Produz (serviços, todos recebem `ator: UsuarioAtual` primeiro):** `listarArvore(ator)` (espaços visíveis com listas), `criarEspaco`, `editarEspaco`, `excluirEspaco`, `definirMembros(ator, espacoId, usuarioIds)`, `criarLista` (cria com `STATUS_PADRAO`), `renomearLista`, `excluirLista`, `salvarStatus(ator, listaId, status[])` (cria/edita/reordena; valida com `validarConjuntoStatus`), `excluirStatus(ator, statusId, destinoId)` (move tarefas, valida conjunto).

- [ ] Teste dos esquemas: nome vazio recusado, cor fora de `#RRGGBB` recusada.
- [ ] Implementar serviços e ações (padrão `try/exigirPermissao/parse/serviço/revalidatePath/tratarErroAcao`); typecheck; commit.

### Tarefa 5: Tarefas
**Arquivos:** `esquemas/tarefa.ts` (+ teste), `servicos/tarefas.ts`, `acoes/tarefas.ts`.

**Produz:** `listarTarefasDaLista(ator, listaId, filtros)`, `obterTarefa(ator, id)`, `criarTarefa(ator, { listaId, titulo, tarefaPaiId? })` (status = primeiro `aberto`), `atualizarTarefa(ator, id, campos)` (titulo, descricao, prioridade, datas, responsáveis — membros do espaço ou admin/gestor), `mudarStatus(ator, id, statusId, confirmarSubtarefasAbertas?)` (regras 4 e 6; erro `ErroNegocio("SUBTAREFAS_ABERTAS")` para a tela confirmar), `excluirTarefa(ator, id)`, `listarMinhasTarefas(ator)` agrupado com `grupoDaEntrega`.

- [ ] Teste do esquema: `dataInicio` > `dataEntrega` recusada com erro em `dataInicio`; título com só espaços recusado; subtarefa de subtarefa recusada no serviço.
- [ ] Implementar; typecheck; commit.

### Tarefa 6: Telas
**Arquivos:** `src/app/(app)/layout.tsx`, `menu-navegacao.tsx` (árvore de espaços), `src/app/(app)/tarefas/page.tsx` (redireciona para minhas), `tarefas/minhas/page.tsx`, `tarefas/listas/[listaId]/page.tsx`, `tarefas/espacos/[espacoId]/configuracoes/page.tsx`, componentes em `src/modulos/tarefas/componentes/`.

- [ ] Menu com Minhas tarefas e árvore; "+ Novo espaço" e "+ Nova lista" para quem pode.
- [ ] Lista: tabela agrupada por status, criação rápida, filtros (responsável, prioridade, atrasadas) via `searchParams`.
- [ ] Painel `?tarefa=` com campos editáveis, subtarefas e confirmação de subtarefas abertas.
- [ ] Configurações do espaço: nome, cor, membros; status da lista em diálogo.
- [ ] Minhas tarefas: 4 grupos + "Depois".
- [ ] Verificar no navegador as telas que não dependem do banco; lint, typecheck, testes; commit.

### Tarefa 7: Docs e publicação
- [ ] Atualizar `docs/modulos/tarefas.md` (vocabulário, sem pastas, situação da implementação) e a matriz em `docs/04-seguranca-permissoes.md`.
- [ ] `git push origin teste`; acompanhar build com `hosting_get-deployment`; conferir rotas no ar e roteiro de teste para o usuário.
