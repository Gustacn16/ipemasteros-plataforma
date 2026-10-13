# IPEMaster OS

Sistema operacional interno da IPEMaster (educação médica: pós-graduações e cursos livres).
Visão completa em `docs/01-visao-geral.md`.

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui
- Prisma ORM + MySQL (Hostinger) · Better Auth (e-mail/senha) · Zod (validação)
- Hospedagem: Hostinger Cloud (app Node.js) com deploy automático via GitHub
- Testes: Vitest (unidade) e Playwright (e2e)

## Comandos
```
npm run dev          # servidor local
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run db:migrate   # prisma migrate dev --name <nome>  (cria migration)
npm run db:deploy    # prisma migrate deploy             (aplica em teste/produção)
npm run db:seed      # dados de exemplo
npm run build        # build de produção
```

## Convenções
- **Idioma:** tudo em português — docs, interface, nomes de domínio no código (`Aluno`, `Turma`, `criarTarefa`). Termos técnicos do framework ficam como são (`page.tsx`, `route.ts`).
- **Código:** módulos em `src/modulos/<modulo>/` (servicos, acoes, componentes, esquemas). Rotas em `src/app/`.
- **Nomes:** componentes `PascalCase`, funções/variáveis `camelCase`, arquivos `kebab-case`, tabelas `snake_case` no plural via `@@map`.
- **Banco:** ids `cuid`, campos `criadoEm`/`atualizadoEm`; exclusão lógica com `excluidoEm` onde houver dado de negócio.
- **Datas:** salvas em UTC, exibidas em `America/Sao_Paulo`.
- **Commits:** Conventional Commits em português (`feat(tarefas): adiciona subtarefas`).

## Regras fixas
1. **Antes de mexer num módulo, leia `docs/modulos/<modulo>.md`.** Se a mudança alterar regras, entidades ou telas, atualize esse arquivo no mesmo PR.
2. **Toda mudança de banco é feita por migration do Prisma.** Nunca alterar o banco manualmente nem usar `prisma db push` fora do ambiente local.
3. **Nunca editar este CLAUDE.md sem pedido explícito.**
4. **Branches:** `teste` (homologação) e `main` (produção). O trabalho entra em `teste`, e `main` só recebe merge vindo de `teste` depois de validado. Nunca commitar direto em `main`.
5. **Permissões são checadas no servidor** em toda Server Action e Route Handler (`docs/04-seguranca-permissoes.md`). Esconder um botão na tela não é controle de acesso.
6. **Ações sensíveis geram registro de auditoria:** criar, editar ou excluir dado pessoal, alterar papéis, exportar dados.
7. **LGPD:** nunca logar CPF, tokens ou senhas, e nunca colocar dado pessoal em URL.
8. Decisões de arquitetura novas viram ADR em `docs/decisoes/`.
