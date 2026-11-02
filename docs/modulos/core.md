# Módulo: Core

## Objetivo
Base comum a todos os módulos: identidade, acesso, papéis, auditoria e conformidade com a LGPD.

## Entidades
| Entidade | Campos principais | Observações |
|---|---|---|
| `Usuario` | id, nome, email (único), papel (`admin`/`gestor`/`colaborador`/`professor`/`aluno`), ativo, imagem (URL da foto), apelido, whatsapp (só dígitos, com DDD), cargo, dataNascimento, perfilCompletoEm, ultimoAcessoEm | Desativar em vez de excluir |
| `FotoUsuario` | usuarioId, dados (MEDIUMBLOB, até 512 KB), tipo | Foto de perfil 400×400 (ADR 0004) |
| `Sessao`, `Conta`, `Verificacao` | Padrão Better Auth | Gerenciadas pela lib. Não alterar à mão |
| `Convite` | id, email, papel, tokenHash, expiraEm, aceitoEm, convidadoPorId | Validade de 72h, uso único |
| `LogAuditoria` | id, usuarioId?, acao, entidade, entidadeId, diff (JSON), ip, userAgent, criadoEm | Somente inserção |
| `SolicitacaoTitular` | id, tipo (`acesso`/`correcao`/`anonimizacao`/`portabilidade`), titularTipo, titularId, status, prazoEm, atendidoPorId, observacoes | Ver 04-seguranca |

## Telas
- `/login`, `/recuperar-senha`, `/convite/[token]` (dados básicos, foto e senha)
- `/completar-cadastro`: etapa obrigatória para quem ainda não tem dados básicos e foto
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
8. **Primeiro acesso:** `/primeiro-acesso` cria o primeiro admin. A página só existe enquanto o banco não tem nenhum usuário e exige o `TOKEN_PRIMEIRO_ACESSO` do servidor. Depois do primeiro usuário, ela responde 404.
9. Ninguém altera o próprio papel nem desativa a própria conta. Isso evita se trancar fora do sistema.
10. Um novo convite para o mesmo e-mail revoga o convite pendente anterior.
11. Na auditoria, o gestor vê só as ações feitas por ele mesmo. O admin vê tudo.
12. **Cadastro obrigatório:** no aceite do convite, a pessoa preenche nome completo, apelido, WhatsApp, cargo, data de nascimento e foto, junto com a senha. Contas sem esses dados (`perfilCompletoEm` nulo, como o primeiro admin) são levadas a `/completar-cadastro` por `exigirUsuario()` antes de qualquer tela. A foto fica no banco (ADR 0004) e é servida só a usuários logados. A data de nascimento não aparece para outros colaboradores.

> As regras 4 (tokens Google) e 6 (vínculo com `Professor`) passam a valer quando os módulos Agenda (F3) e Acadêmico (F2) existirem.

## Situação da implementação (F0)
**Feito:**
- Login por e-mail e senha, convite com link de 72h, primeiro acesso.
- Recuperação de senha (link de 1h).
- Papéis com checagem no servidor.
- Telas `/admin/usuarios` e `/admin/auditoria`.
- Auditoria de login, logout, convites, papel e ativação.
- Limite de tentativas: 5 logins por minuto por IP.

**Pendente:**
- Bloqueio **por conta** após 5 tentativas falhas. Hoje o limite é só por IP.
- 2FA para admin e gestor.
- Verificação contra senhas vazadas.
- Telas `/perfil`, `/admin/lgpd`, `/admin/integracoes` e `/admin/saude`.

## Permissões
Ver a matriz em `04-seguranca-permissoes.md`. O helper central fica em `src/lib/permissoes.ts`.

## Dúvidas em aberto
- Quem será o encarregado (DPO)?
- O 2FA para gestor é obrigatório já na F0 ou só na F1?
