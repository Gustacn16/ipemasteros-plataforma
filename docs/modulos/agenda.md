# Módulo: Agenda

## Objetivo
Cada usuário (incluindo professores) conecta **seu próprio** Google Calendar e vê no sistema seus compromissos junto com as aulas e tarefas da IPEMaster. O sistema também consegue criar eventos no calendário do usuário.

## Entidades
| Entidade | Campos principais |
|---|---|
| `ConexaoGoogle` | id, usuarioId, emailGoogle, accessTokenCriptografado, refreshTokenCriptografado, expiraEm, escopos, status (`ativa`/`expirada`/`revogada`), conectadoEm |
| `CalendarioConectado` | id, conexaoId, googleCalendarId, nome, cor, exibir (bool), calendarioPadraoEscrita (bool) |
| `EventoVinculado` | id, conexaoId, googleCalendarId, googleEventId, tipoOrigem (`aula`/`tarefa`/`publicacao`), origemId, etag, sincronizadoEm |

Os eventos do Google **não** são copiados para o banco. São lidos da API sob demanda, com cache curto de 5 min por usuário. Só guardamos o vínculo dos eventos que o próprio sistema criou.

## Telas
- `/agenda`: visões de dia, semana e mês. Mostra:
  - eventos dos calendários Google marcados como "exibir";
  - aulas em que o usuário é professor;
  - tarefas com data atribuídas a ele.
  Cada origem tem cor e filtro próprios.
- `/perfil/conexoes`: botão "Conectar Google Agenda", escolha dos calendários exibidos e do calendário padrão para criar eventos, botão de desconectar.
- Criação rápida de evento a partir da agenda, gravada no calendário padrão do usuário.

## Regras de negócio
1. Conectar o Google é opcional. Sem conexão, a agenda mostra só aulas e tarefas do sistema.
2. Escopo OAuth mínimo: `calendar.events` + `calendar.readonly` (listar calendários). Sem acesso a Gmail ou Drive.
3. Os tokens ficam criptografados. O refresh é automático. Se o refresh falhar, a conexão vira `expirada` e o usuário vê um aviso para reconectar.
4. **Aulas → agenda do professor:** se o professor tiver Google conectado, criar, alterar ou cancelar uma aula cria, atualiza ou remove o evento no calendário padrão dele (rastreado por `EventoVinculado`).
5. **Tarefas → agenda:** enviar ao calendário é opcional, por tarefa ou como preferência do usuário.
6. Edições feitas no Google em eventos criados pelo sistema **não** voltam para o sistema. O sistema é a fonte da verdade para aulas e tarefas. O job de sincronização detecta divergências pelo `etag` e reaplica os dados do sistema.
7. Desconectar ou desativar o usuário revoga o token no Google e apaga os tokens locais. Os eventos já criados permanecem no calendário do usuário.
8. Um usuário só vê a própria agenda. Gestor e admin **não** veem os calendários Google de outras pessoas.

## Integrações
Google Calendar API v3, com OAuth 2.0 próprio (sem relação com o login). O app no Google Cloud precisa passar pela verificação do Google para escopos de calendário antes de ir para produção.

## Fora do escopo (v1)
Agenda compartilhada da equipe, busca de horário livre entre pessoas, reserva de salas.

## Dúvidas em aberto
- A equipe usa contas Google Workspace (domínio da IPEMaster) ou Gmail pessoal? Com Workspace, dá para publicar o app OAuth como "interno" e pular a verificação do Google.
