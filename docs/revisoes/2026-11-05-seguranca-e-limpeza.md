# Revisão de segurança e limpeza de código — 05/11/2026

Revisão automática feita de madrugada no branch `revisao/seguranca-2026-11-05` (criado a partir de `teste`, commit `3ffe6b9`). Nenhum banco, variável de ambiente ou configuração da Hostinger foi tocado.

## Resumo (para leigo)

1. **No geral o sistema está bem protegido:** toda ação e toda rota confere quem está logado e o que essa pessoa pode fazer, e isso é feito no servidor, não só na tela.
2. **O mais urgente já foi corrigido:** 11 falhas "altas" em bibliotecas de terceiros (atualizadas só em versões compatíveis) e um jeito de alguém logado mandar um pedido forjado que mudaria várias turmas ou professores de uma vez.
3. **Não achei senha, chave ou dado de aluno no código**, nem dado pessoal em logs ou URLs.
4. **O que falta é o que a documentação promete e ainda não existe:** 2FA para admin e gestor, bloqueio depois de 5 senhas erradas e o cabeçalho CSP. Isso precisa da sua decisão (lista no fim).
5. Limpeza pequena: 5 pedaços de código que ninguém usava foram removidos; o resto ficou listado como "possivelmente sem uso".

## Achados de segurança

### Alta

| # | Onde | Risco | Situação |
|---|---|---|---|
| A1 | `package-lock.json` | 11 bibliotecas usadas em produção tinham falhas conhecidas de gravidade alta (undici, mysql2, mariadb, zod, body-parser, deepmerge-ts e outras), como travar o servidor com uma resposta grande. | **Corrigido** (commit `de828e1`). `npm audit fix` sem `--force`, mais o `@prisma/client` em 7.10.1 para ficar igual ao Prisma CLI. Nenhuma versão major mudou e o `package.json` continua igual. Sobraram 0 altas. |

### Média

| # | Onde | Risco | Situação |
|---|---|---|---|
| M1 | Server Actions que recebem id direto: `src/modulos/academico/acoes/academico.ts` (situação da turma, excluir turma, ativar professor), `comercial/acoes/*.ts` (produto, oferta, link, canal, venda, conta da Meta), `conteudo/acoes/conteudo.ts`, `tarefas/acoes/*.ts`, `core/acoes/usuarios.ts` | O TypeScript não protege no servidor. Quem está logado podia forjar a chamada e mandar `{ not: "" }` no lugar do id. Em `definirSituacaoTurma` (`academico/servicos/turmas.ts`) e `definirAtivoProfessor` (`academico/servicos/professores.ts`), que usam `updateMany`, isso mudaria **todas** as turmas ou **todos** os professores de uma vez. | **Corrigido** (commit `b28cb51`). Novas funções `idDaAcao` e `booleanoDaAcao` em `src/lib/acoes.ts` (com teste) exigem texto e booleano. Na tela nada muda. |
| M2 | `next.config.mjs:6` | Falta o cabeçalho **CSP** (Content-Security-Policy), que a doc 04 promete. Ele é a segunda barreira contra XSS. Hoje não achei nenhum ponto de XSS (não há `dangerouslySetInnerHTML`), mas falta a barreira. | **Sugestão.** Um CSP mal feito quebra telas (scripts do Next, imagens da Meta), então precisa ser testado em `teste` antes. |
| M3 | `src/lib/auth.ts` | A doc 04 promete: **2FA (TOTP) obrigatório para admin e gestor**, **bloqueio de 15 min depois de 5 senhas erradas** e **auditoria de falha de login**. Nada disso existe ainda. Hoje existe só um limite de 5 tentativas por minuto por IP. | **Sugestão / decisão** (item 1). |
| M4 | `src/lib/auth.ts:116` (`ipAddressHeaders: ["x-forwarded-for", "x-real-ip"]`) | O limite de tentativas de login usa o IP desse cabeçalho. Se o proxy da Hostinger não sobrescrever o cabeçalho, um atacante pode inventar um IP novo a cada tentativa e escapar do limite. | **Sugestão:** confirmar com a Hostinger (item 2). |

### Baixa

| # | Onde | Risco | Situação |
|---|---|---|---|
| B1 | `src/modulos/comercial/servicos/meta-graph.ts:94` | A paginação da Meta seguia qualquer endereço em `paging.next`, mandando o token da Meta junto. | **Corrigido** (commit `acebf02`, com teste): só segue endereços de `graph.facebook.com`. |
| B2 | `src/modulos/academico/servicos/professores.ts` (`definirAtivoProfessor`) | Ativar ou desativar professor não gerava auditoria, e a edição de professor gera. | **Corrigido** (commit `e066781`): registra `professor.editado` com o campo `ativo`, sem valores. |
| B3 | `src/modulos/comercial/servicos/importacao-meta.ts` (`definirContaAtiva`) | Única função de serviço que não confere a permissão. A ação que a chama confere, então hoje não há falha, mas foge do padrão. | Sugestão: passar o `ator` e checar `comercial:gerenciar_integracao_meta` também no serviço. |
| B4 | `src/modulos/academico/acoes/importacao.ts:17` | A planilha é limitada a 5 MB, mas o .xlsx é um zip. Um arquivo de 5 MB pode virar centenas de MB na memória ao abrir (o "zip bomb"). Só quem tem `academico:importar_alunos` (admin e gestor) consegue enviar. | Sugestão: limitar também o número de linhas lidas. |
| B5 | `src/app/api/agenda/assinatura/[arquivo]/route.ts` | O link .ics leva o token no endereço (como manda a ADR 0005), e logs de acesso da hospedagem podem guardá-lo. | Sugestão: só confirmar que os logs de acesso da Hostinger não ficam acessíveis a terceiros. Gerar o link de novo invalida o antigo. |
| B6 | `src/proxy.ts:17` | A checagem rápida de login só cobre `/inicio`, `/admin` e `/perfil`. As outras áreas (tarefas, comercial etc.) são protegidas de verdade pelas próprias páginas, então **não é falha**: o efeito é só o redirecionamento ao login acontecer um passo depois. | Sugestão opcional: incluir as outras áreas no `matcher`. |
| B7 | `npm audit` (alertas moderados que sobraram) | `exceljs` usa uma versão antiga do `uuid` (a falha só existe com um parâmetro que o exceljs não usa). O `shadcn` traz `minimatch`/`deepmerge` antigos, mas no sistema ele só fornece um arquivo CSS. | Não corrigido: a única correção oferecida é trocar de versão major (exceljs 3.4 ou shadcn 1.0), o que quebraria coisas. Decisão no item 5. |

### O que foi conferido e está certo

- **Todos os 13 arquivos de Server Actions** chamam `exigirPermissao` antes de qualquer coisa. Os 4 Route Handlers também se protegem: `api/auth` é o próprio Better Auth, `api/cron` confere o segredo em tempo constante e recusa tudo se o segredo não estiver configurado, `api/usuarios/[id]/foto` exige login e `api/agenda/assinatura` exige o token.
- **Todas as páginas** da área logada chamam `exigirUsuario` ou `exigirPermissaoPagina`.
- **As regras por registro estão aplicadas nos serviços:** colaborador só vê os espaços em que é membro (`tarefas/servicos/acesso.ts`), o vendedor só mexe nas próprias vendas e só vê as próprias metas (`comercial/servicos/vendas.ts`, `metas.ts`, `dashboard.ts`), cada um só vê as próprias agendas pessoais e o gestor só vê a própria auditoria.
- **Entradas validadas com Zod:** nenhum `$queryRaw`/`$executeRaw` no código e nenhum `dangerouslySetInnerHTML`. Os únicos redirecionamentos vão para endereços fixos.
- **Tokens** (convite, assinatura da agenda) ficam no banco só como hash. Os segredos são comparados em tempo constante (`src/lib/tokens.ts`, `src/lib/cron.ts`).
- **A foto de perfil** é validada pelo conteúdo do arquivo (JPG, PNG ou WebP de verdade, não só pelo nome) e pelo tamanho.
- **O link iCal externo** só aceita Google e Outlook, inclusive depois de redirecionamentos, com limite de tempo e de tamanho (proteção contra SSRF).
- **Logs:** o único `console.*` é o e-mail mostrado no terminal em desenvolvimento, que em produção nunca roda. A auditoria registra só os nomes dos campos alterados, sem valores pessoais.
- **Segredos:** nenhuma chave, senha ou token no código. O `.env.example` só tem valores de exemplo.
- **Páginas de servidor que importam constantes de arquivos `"use client"`:** nenhuma encontrada. Foram conferidos os 10 arquivos client que exportam constantes ou funções.
- **Cabeçalhos:** HSTS, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy estão ativos. Os cookies seguem o padrão do Better Auth (httpOnly, sameSite=lax e secure em https).

## Banco de dados (só sugestões; tudo precisaria de migration)

1. **Alunos e professores não têm exclusão lógica nem anonimização** (`Aluno`, `Professor` em `prisma/schema.prisma`). A doc 04 prevê anonimizar alunos de cursos livres 5 anos após a turma e atender pedidos de exclusão (art. 18). Sugestão: campos `excluidoEm` e `anonimizadoEm`.
2. **`Aluno.email` sem índice.** Buscar ou evitar aluno duplicado por e-mail vai varrer a tabela inteira. Sugestão: `@@index([email])`. Não precisa ser único, porque alunos antigos podem não ter e-mail.
3. **Sessões, verificações e convites vencidos nunca são apagados** (`Sessao`, `Verificacao`, `Convite`). Sugestão: um job em `/api/cron/` para limpar, e um índice em `Sessao.expiresAt`.
4. **Retenção da auditoria (5 anos) sem rotina**: ainda não é urgente, mas vale um job quando o sistema fizer 5 anos.
5. **`onDelete: Cascade` a partir de `Usuario`** (sessões, contas, membros de espaço, agendas pessoais, assinatura). Está certo enquanto ninguém apagar usuário de verdade (hoje só se desativa). Mantenha a regra de nunca apagar usuário direto no banco.
6. **`Matricula` → `Aluno`/`Turma` sem `onDelete`** (padrão: impede apagar). Está bom: protege o histórico acadêmico.
7. Chaves únicas e índices das consultas mais frequentes (tarefas por lista e status, vendas por vendedor e data, métricas por dia, auditoria por usuário e data) já existem.

## Código removido

| O quê | Onde | Por que é seguro |
|---|---|---|
| `esquemaLogin`, `esquemaRecuperarSenha`, `esquemaRedefinirSenha` | `src/modulos/core/esquemas/usuario.ts` | Nenhum uso em `src`, `scripts`, `prisma` ou `docs`. As telas de login e senha usam o cliente do Better Auth, que já valida. |
| `listarStatus` | `src/modulos/tarefas/servicos/listas.ts` | Nenhuma chamada em lugar nenhum. |
| `ROTULO_TIPO_COMISSAO` | `src/modulos/comercial/esquemas/produto.ts` | Nenhum uso. O tipo `TipoComissao` continua. |

Nenhuma dependência do `package.json` foi removida: todas estão em uso. O `cn` é a biblioteca oficial do shadcn, e o `@next/swc-wasm-nodejs` é necessário para o build na Hostinger (ADR 0002). Não achei código comentado antigo nem TODO/FIXME.

## Possivelmente sem uso (não removido)

- **`renomearListaAcao` e `excluirListaAcao`** (`src/modulos/tarefas/acoes/estrutura.ts`), com `renomearLista`/`excluirLista` e `esquemaRenomearLista`. Funcionam e conferem permissão, mas nenhuma tela as chama. Pode ser que estejam planejadas ("listas e status" na matriz da doc 04). Decisão no item 4.
- **`scripts/gerar-sql-catalogo.ts`**: nenhum código importa, mas está documentado em `docs/modulos/comercial.md` como o gerador da migration do catálogo. Fica.
- **Componentes shadcn** (`src/componentes/ui/*`) com partes sem uso (AlertTitle, CardFooter, DropdownMenuSub, SelectGroup etc.). Ficam por regra.
- **Cerca de 30 exports usados só dentro do próprio arquivo** (ex.: `obterOrigemRequisicao`, `separarErrosDoLote`, `MAX_OCORRENCIAS`, `TOM_PRIORIDADE`): o código é usado, só a palavra `export` sobra. Não mexi porque não ganha nada.
- **Modelo `SolicitacaoTitular`**: sem tela ainda, mas planejado na doc 04 (LGPD).

## O que precisa de decisão do Gustavo

1. **Login mais forte (M3):** quer que eu implemente 2FA para admin e gestor, bloqueio de 15 min depois de 5 senhas erradas e auditoria de falha de login? O Better Auth tem plugin de 2FA. Isso muda a tela de login e precisa de migration.
2. **IP do login (M4):** perguntar ao suporte da Hostinger se o proxy sobrescreve o `X-Forwarded-For`. Se não sobrescrever, ajusto para confiar só no cabeçalho que a Hostinger garante.
3. **CSP (M2):** posso preparar o cabeçalho em modo "só relatar" (`Content-Security-Policy-Report-Only`) para testar em `teste` sem quebrar nada?
4. **Renomear e excluir lista:** criar a tela para essas ações ou apagar as ações sem uso?
5. **Alertas moderados restantes (B7):** aceitar o risco por enquanto (minha recomendação) ou trocar a biblioteca de planilha?
6. **Alunos (banco 1):** quando quiser, preparo a migration de exclusão e anonimização de alunos para os pedidos da LGPD.
7. **Limpeza automática (banco 3):** criar o job que apaga sessões, convites e verificações vencidos?

## Resultado final das verificações

Rodadas no fim, no branch da revisão (o Prisma recebeu um `DATABASE_URL` fictício só para gerar o cliente, sem conectar a banco nenhum):

- `npm run typecheck`: **0 erros**
- `npm run lint`: **0 problemas**
- `npx vitest run`: **48 arquivos, 496 testes, todos passaram** (antes eram 47 arquivos e 492 testes; os 4 novos cobrem as correções M1 e B1)
- `npx next build --webpack`: **compilou com sucesso.** Os avisos do Better Auth sobre `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` só aparecem porque a pasta local não tem variáveis de ambiente.
- `npm audit --omit=dev`: **de 21 alertas (11 altos) para 8 (0 altos, 6 moderados, 2 baixos)**
