# 0001 — Escolha da stack

- **Status:** Aceito
- **Data:** 2026-10-13

## Contexto
A IPEMaster precisa de um sistema interno com vários módulos (tarefas, agenda, acadêmico, conteúdo, dashboard) e algumas telas públicas (formulários de presença e avaliação). As restrições são:
- equipe de desenvolvimento pequena, com forte apoio de IA (Claude Code);
- hospedagem na **Hostinger**, onde a empresa já tem domínio, no plano **Cloud**;
- deploy a partir de um repositório **GitHub**, com ambientes de homologação (`teste`) e produção (`main`);
- dados pessoais de alunos (CPF, CRM) sob a **LGPD**;
- integrações com Google Calendar, Meta e Kommo.

## Decisão

| Camada | Escolha |
|---|---|
| Framework | **Next.js (App Router)**: Server Components, Server Actions, Route Handlers |
| Linguagem | **TypeScript** em modo `strict` |
| Estilo/UI | **Tailwind CSS** + **shadcn/ui** (componentes copiados para o repositório, acessíveis, baseados em Radix) |
| Banco | **MySQL 8** gerenciado pela Hostinger |
| ORM | **Prisma** (schema declarativo + migrations versionadas) |
| Autenticação | **Better Auth** (e-mail/senha, sessões no banco, 2FA, adapter Prisma) |
| Validação | **Zod**, compartilhado entre formulários e servidor |
| Testes | **Vitest** + **Playwright** |
| Hospedagem | **Hostinger Cloud**, app Node.js com deploy automático por branch do GitHub |
| Jobs | **Cron do hPanel** chamando Route Handlers protegidos por segredo |
| Gerenciador de pacotes | **npm**, o padrão do build da Hostinger |

### Por que essas escolhas
- **Next.js num único app:** front, back e telas públicas no mesmo projeto e na mesma linguagem. Server Actions eliminam a necessidade de uma API REST separada para as telas internas. A Hostinger Cloud suporta apps Node.js/Next.js nativamente, com deploy pelo GitHub.
- **TypeScript + Prisma + Zod:** os tipos vão do banco até a tela, o que reduz erros. É o caminho mais seguro para código gerado com apoio de IA.
- **Tailwind + shadcn/ui:** velocidade para montar telas de sistema interno (tabelas, formulários, modais) com um visual consistente e sem depender de uma biblioteca de componentes fechada.
- **MySQL (e não PostgreSQL):** o plano Cloud da Hostinger inclui MySQL gerenciado, com backup, no mesmo datacenter da aplicação. PostgreSQL exigiria um provedor externo (Supabase, Neon), com custo extra, latência entre provedores e mais um operador de dados pessoais para declarar na LGPD. O Prisma abstrai as diferenças, e nada nos módulos previstos depende de recursos exclusivos do Postgres.
- **Better Auth:** login próprio por e-mail e senha (requisito: acesso por convite, não por Google), 2FA, sessões no banco, integração com o Prisma, código no nosso controle e sem custo por usuário. O Auth.js foi descartado porque desencoraja login por senha, e o projeto hoje é mantido junto ao Better Auth.
- **Cron da Hostinger:** atende jobs simples (sincronizações, publicações agendadas) sem adicionar uma infraestrutura de filas.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Laravel/PHP (forte na Hostinger) | Exigiria duas linguagens (PHP + JS no front) e um ecossistema de UI menos alinhado ao que queremos |
| Front React + API separada (NestJS/Express) | Dois projetos e dois deploys sem benefício real para um sistema interno deste porte |
| Supabase (Postgres + Auth + Storage) | Rápido de começar, mas tira os dados da Hostinger, cria dependência de fornecedor e soma mais um operador de dados LGPD |
| Drizzle ORM | Bom e mais leve, mas o Prisma tem migrations e ferramentas mais maduras e foi preferido pelo responsável do projeto |
| Clerk / Auth0 | Custo por usuário, dados de identidade fora do país e menos controle |
| Vercel | Melhor DX para Next.js, mas a empresa já usa e paga a Hostinger, e o banco ficaria em outro provedor |
| VPS na Hostinger | Mais controle (Postgres, Redis, workers), mas exige administrar servidor. Fica como caminho de evolução se o Cloud limitar |

## Consequências
**Positivas**
- Um repositório, uma linguagem, um deploy por ambiente.
- Tipagem de ponta a ponta e migrations versionadas no Git.
- Dados e aplicação no mesmo provedor, o que simplifica o mapa LGPD.

**Negativas / riscos**
- **Recursos do plano Cloud:** limites de memória e processos podem afetar builds e jobs pesados. *Mitigação:* jobs curtos e idempotentes, monitorar uso, VPS como plano B.
- **Sem filas nem workers persistentes:** publicação e importação dependem do cron (granularidade mínima de minutos). Aceitável para os casos previstos.
- **Disco da aplicação não é lugar de arquivos:** anexos precisam de storage externo compatível com S3 (ADR pendente).
- **MySQL** não tem alguns recursos do Postgres (ex.: índices parciais, `jsonb` avançado). As modelagens devem evitar depender deles.
- O Better Auth é mais novo que o Auth.js. Fixar versões e acompanhar os changelogs.
