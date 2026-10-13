# Módulo: Tarefas

## Objetivo
Gestão de tarefas no modelo do ClickUp: hierarquia Espaço → Pasta → Lista → Tarefa, status personalizáveis por lista, subtarefas e várias visualizações. A meta é substituir o ClickUp na operação da equipe.

## Entidades
| Entidade | Campos principais |
|---|---|
| `Espaco` | id, nome, cor, icone, privado (bool), membros (relação N:N com Usuario), ordem |
| `Pasta` | id, espacoId, nome, ordem |
| `Lista` | id, espacoId, pastaId?, nome, descricao, ordem |
| `StatusLista` | id, listaId, nome, cor, tipo (`aberto`/`em_andamento`/`concluido`/`fechado`), ordem |
| `Tarefa` | id, listaId, tarefaPaiId? (subtarefa), titulo, descricao (rich text), statusId, prioridade (`urgente`/`alta`/`normal`/`baixa`), dataInicio?, dataEntrega?, estimativaMin?, ordem, turmaId?, publicacaoId?, concluidaEm?, criadoPorId |
| `TarefaResponsavel` | tarefaId, usuarioId |
| `ItemChecklist` | id, tarefaId, texto, concluido, ordem |
| `Etiqueta` | id, espacoId, nome, cor |
| `TarefaEtiqueta` | tarefaId, etiquetaId |
| `Comentario` | id, tarefaId, autorId, texto, menciona (usuários), criadoEm |
| `Anexo` | id, tarefaId, nomeArquivo, tamanho, mime, chaveStorage, enviadoPorId |
| `HistoricoTarefa` | id, tarefaId, usuarioId, campo, valorAntes, valorDepois, criadoEm |

## Telas
- **Barra lateral:** árvore de Espaços, Pastas e Listas, com favoritos.
- **Visualizações de uma lista** (alternáveis, com filtros e agrupamento salvos por usuário):
  - **Lista:** tabela com colunas, agrupada por status.
  - **Quadro (Kanban):** arrastar entre status.
  - **Calendário:** por data de entrega.
- **Minhas tarefas** (`/tarefas/minhas`): tudo atribuído a mim, agrupado em "Atrasadas", "Hoje", "Próximos 7 dias" e "Sem data".
- **Detalhe da tarefa** (painel lateral ou modal): descrição, subtarefas, checklist, responsáveis, datas, prioridade, etiquetas, anexos, comentários e histórico.
- **Configurações do espaço/lista:** membros, status e etiquetas.

## Regras de negócio
1. Ao criar uma lista, ela recebe os status padrão "A fazer" (aberto), "Em andamento" e "Concluído" (concluido). Os status podem ser editados.
2. Toda lista precisa ter pelo menos um status do tipo `aberto` e um do tipo `concluido`.
3. Excluir um status pede um status de destino para as tarefas que estão nele.
4. Mover uma tarefa para um status do tipo `concluido` preenche `concluidaEm`. Sair dele limpa o campo.
5. Subtarefas têm só um nível (subtarefa não tem subtarefa) e herdam a lista da tarefa pai.
6. Concluir uma tarefa pai com subtarefas abertas pede confirmação.
7. Espaço privado só é visível para os membros, além de admin e gestor.
8. Professor só vê as tarefas em que é responsável, sem navegar nos espaços.
9. Menção com `@usuario` em comentário gera notificação no sistema.
10. Toda alteração de status, responsável, datas ou prioridade gera uma linha em `HistoricoTarefa`.
11. Arrastar para reordenar usa ordenação fracionária (`ordem` decimal) para evitar reescrever a lista inteira.

## Integrações
- **Agenda:** tarefas com data podem ser enviadas ao Google Calendar do responsável (opção do usuário).
- **Acadêmico/Conteúdo:** uma tarefa pode ser vinculada a uma turma ou publicação e aparece na tela delas.

## Fora do escopo (v1)
Tarefas recorrentes, controle de tempo (time tracking), automações ("quando X então Y"), dependências entre tarefas, campos personalizados, importação do ClickUp. Ficam como candidatos para a v2.

## Dúvidas em aberto
- Será preciso importar os dados atuais do ClickUp? (A API do ClickUp permite exportar.)
- As notificações por e-mail são necessárias ou bastam as notificações no sistema?
