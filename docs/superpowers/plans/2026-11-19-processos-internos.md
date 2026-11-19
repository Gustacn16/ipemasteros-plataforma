# Plano — Processos internos (P1)

Spec: `docs/superpowers/specs/2026-11-19-processos-internos-design.md`. Branch `processos-internos` (worktree), que entra em `teste` por `merge --ff-only`.

1. **Banco**
   - Criar os modelos e enums em `prisma/schema.prisma`, com relações em `Usuario`.
   - Gerar a migration `20261119120000_processos_internos` com `prisma migrate diff`.
   - Rodar `prisma generate`.
2. **Permissões**
   - Adicionar `processos:ver|editar|registrar_medicao` em `src/lib/permissoes.ts`, com teste em `permissoes.test.ts`.
   - Adicionar as ações em `src/lib/auditoria.ts`.
3. **Regras puras** em `src/modulos/processos/regras/`, todas com teste:
   - `fluxo.ts`: normalizar e validar etapas, calcular o próximo passo.
   - `ligacoes.ts`: extrair `[[...]]` e trocar por links.
   - `indicadores.ts`: período, farol e atraso.
   - `revisao.ts`: revisão vencida.
   - `busca.ts`: normalizar e casar texto.
4. **Esquemas Zod** em `esquemas/processos.ts`, com teste.
5. **Serviços** em `servicos/`:
   - `acesso.ts`
   - `estrutura.ts`: categorias, áreas, árvore e estrutura inicial.
   - `documentos.ts`: criar, salvar, publicar, restaurar, excluir, ler e buscar.
   - `indicadores.ts`: CRUD, medições e painel.
6. **Ações** em `acoes/processos.ts`. Cada uma faz `exigirPermissao`, depois `parse`, chama o serviço e roda `revalidatePath`.
7. **Componentes:**
   - árvore;
   - fluxograma (desenho e editor);
   - markdown com links;
   - ficha;
   - indicadores (farol, gráfico SVG, diálogos);
   - formulários.
8. **Rotas** em `src/app/(app)/processos/...`, mais o item "Processos" no menu.
9. **Docs:**
   - `docs/modulos/processos.md`;
   - ADR 0009;
   - tabela em `docs/04-seguranca-permissoes.md`;
   - `docs/03-modelo-de-dados.md`, se listar tabelas.
10. **Verificação e publicação:**
    - `typecheck`, `lint`, `test` e `next build --webpack`;
    - prévia local (sem banco local, olhar só o que for possível);
    - merge em `teste`, push e `hosting_get-deployment`;
    - conferir no ar.
