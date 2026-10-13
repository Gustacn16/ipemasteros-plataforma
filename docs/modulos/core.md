# Módulo: Core

## Objetivo
Base comum a todos os módulos: identidade, acesso, papéis, auditoria e conformidade com a LGPD.

## Entidades
| Entidade | Campos principais | Observações |
|---|---|---|
| `Usuario` | id, nome, email (único), papel (`admin`/`gestor`/`colaborador`/`professor`/`aluno`), ativo, avatarUrl, fusoHorario (padrão `America/Sao_Paulo`), ultimoAcessoEm | Desativar em vez de excluir |
| `Sessao`, `Conta`, `Verificacao` | Padrão Better Auth | Gerenciadas pela lib. Não alterar à mão |
| `Convite` | id, email, papel, tokenHash, expiraEm, aceitoEm, convidadoPorId | Validade de 72h, uso único |
| `LogAuditoria` | id, usuarioId?, acao, entidade, entidadeId, diff (JSON), ip, userAgent, criadoEm | Somente inserção |
| `SolicitacaoTitular` | id, tipo (`acesso`/`correcao`/`anonimizacao`/`portabilidade`), titularTipo, titularId, status, prazoEm, atendidoPorId, observacoes | Ver 04-seguranca |

## Telas
- `/login`, `/recuperar-senha`, `/convite/[token]` (definir senha)
- `/perfil`: dados pessoais, senha, 2FA, conexões (atalho para a Agenda)
- `/admin/usuarios`: lista, convidar, mudar papel, desativar
- `/admin/auditoria`: busca por usuário, entidade, ação e período
- `/admin/lgpd`: solicitações de titulares
- `/admin/integracoes`: status das conexões Meta e Kommo
- `/admin/saude`: status de banco, jobs e integrações

## Regras de negócio
1. Não existe cadastro público. Todo usuário entra por convite.
2. Gestor só convida `colaborador` ou `professor`. Só o admin cria outro admin ou gestor.
3. Deve existir sempre pelo menos um admin ativo: o sistema impede rebaixar ou desativar o último.
4. Desativar um usuário encerra as sessões, revoga os tokens Google e mantém o histórico (tarefas e logs continuam apontando para ele).
5. Mudança de papel tem efeito imediato: as sessões são invalidadas.
6. Ao convidar um professor, o sistema vincula o usuário a um `Professor` existente pelo e-mail, ou cria um.
7. Toda ação listada em "Auditoria" (04-seguranca) chama `registrarAuditoria()` dentro da mesma transação.

## Permissões
Ver a matriz em `04-seguranca-permissoes.md`. O helper central fica em `src/lib/permissoes.ts`.

## Dúvidas em aberto
- Quem será o encarregado (DPO)?
- O 2FA para gestor é obrigatório já na F0 ou só na F1?
