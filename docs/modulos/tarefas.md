# Módulo: Tarefas

## Objetivo
Gestão de tarefas no modelo do ClickUp: hierarquia Espaço → Lista → Tarefa, status personalizáveis por lista, subtarefas e várias visualizações. A meta é substituir o ClickUp na operação da equipe, começando do zero (sem importar dados do ClickUp).

Especificação da F1a: `docs/superpowers/specs/2026-11-02-f1a-tarefas-design.md`.

## Vocabulário
| Na operação | No sistema |
|---|---|
| Departamento | Espaço (ex.: Marketing) |
| Grupo de demandas | Lista (ex.: Campanhas) |
| Demanda | Tarefa |

## Entidades
| Entidade | Campos principais |
|---|---|
| `Espaco` | id, nome, cor, ordem, excluidoEm, membros (`MembroEspaco`, N:N com Usuario) |
| `Lista` | id, espacoId, nome, ordem, excluidoEm |
| `StatusLista` | id, listaId, nome, cor, tipo (`aberto`/`em_andamento`/`concluido`), ordem |
| `Tarefa` | id, listaId, tarefaPaiId? (subtarefa), titulo, descricao (texto simples na F1a), statusId, prioridade (`urgente`/`alta`/`normal`/`baixa`), dataInicio? e dataEntrega? (só data), ordem, concluidaEm?, criadoPorId, excluidoEm |
| `TarefaResponsavel` | tarefaId, usuarioId |
| `ItemChecklist` | id, tarefaId, texto, concluido, ordem |
| `Etiqueta` | id, espacoId, nome, cor |
| `TarefaEtiqueta` | tarefaId, etiquetaId |
| `Comentario` | id, tarefaId, autorId, texto, menciona (usuários), criadoEm |
| `Anexo` | id, tarefaId, nomeArquivo, tamanho, mime, chaveStorage, enviadoPorId |
| `HistoricoTarefa` | id, tarefaId, usuarioId, campo, valorAntes, valorDepois, criadoEm |

## Telas
- **Navegação:** o menu principal tem o item "Tarefas". Dentro do módulo, um menu próprio mostra Minhas tarefas, Relatório e a árvore de Espaços e Listas (no celular, recolhível no topo).
- **Visualizações de uma lista** (alternáveis, com filtros e agrupamento salvos por usuário):
  - **Lista:** tabela com colunas, agrupada por status.
  - **Quadro (Kanban):** uma coluna por status. Cada cartão tem o menu "Mover para" (⋯) e o botão de concluir (✓). A mudança aparece na hora e volta, com aviso, se o servidor recusar. Arrastar com o mouse fica para depois. O cartão mostra faixa e selo de prioridade, situação da entrega (atrasada, hoje, amanhã, em N dias), progresso das subtarefas e responsáveis.
  - A escolha Lista/Quadro fica salva no cookie `tarefas_visao` (por navegador, vale para todas as listas).
  - **Calendário:** por data de entrega.
- **Minhas tarefas** (`/tarefas/minhas`): tudo atribuído a mim, agrupado em "Atrasadas", "Hoje", "Próximos 7 dias" e "Sem data".
- **Relatório** (`/tarefas/relatorio`): no topo, os números do próprio usuário (abertas, atrasadas agora, entregues no período e % no prazo); embaixo, uma tabela por pessoa com as mesmas colunas. Admin e gestor (`tarefas:ver_relatorio_equipe`) veem a equipe toda (usuários ativos com tarefa no filtro); os demais veem só a própria linha. Filtros na URL: período (`periodo=semana|mes|mes_passado|intervalo`, com `de` e `ate` no intervalo livre; padrão este mês; semana de segunda a domingo) e espaço (`espaco`, padrão todos os visíveis). Clicar numa pessoa (`?pessoa=id`) lista as tarefas dela que entraram na conta, com o selo "No prazo", "Atrasada" ou "Sem data".
- **Detalhe da tarefa** (painel lateral ou modal): descrição, subtarefas, checklist, responsáveis, datas, prioridade, etiquetas, anexos, comentários e histórico.
- **Configurações do espaço/lista:** membros, status e etiquetas.

## Regras de negócio
1. Ao criar uma lista, ela recebe os status padrão "A fazer" (aberto), "Em andamento" e "Concluído" (concluido). Os status podem ser editados.
2. Toda lista precisa ter pelo menos um status do tipo `aberto` e um do tipo `concluido`.
3. Excluir um status pede um status de destino para as tarefas que estão nele.
4. Mover uma tarefa para um status do tipo `concluido` preenche `concluidaEm`. Sair dele limpa o campo.
5. Subtarefas têm só um nível (subtarefa não tem subtarefa) e herdam a lista da tarefa pai.
6. Concluir uma tarefa pai com subtarefas abertas pede confirmação.
7. Cada pessoa só vê os espaços em que é membro; admin e gestor veem todos. Só membros (ou admin/gestor) podem ser atribuídos; quem sai do espaço continua responsável pelas tarefas que já tinha.
8. Professor só vê as tarefas em que é responsável, sem navegar nos espaços.
9. Menção com `@usuario` em comentário gera notificação no sistema.
10. Toda alteração de status, responsável, datas ou prioridade gera uma linha em `HistoricoTarefa`.
11. Arrastar para reordenar usa ordenação fracionária (`ordem` decimal) para evitar reescrever a lista inteira.

## Relatório: como é calculado
- **Abertas:** tarefas sem `concluidaEm`, contadas agora (o período não vale para elas). **Atrasadas agora:** abertas com entrega anterior a hoje.
- **Entregues:** `concluidaEm` dentro do período (do primeiro dia à meia-noite até o fim do último dia, em São Paulo).
- **No prazo:** entregues com `concluidaEm` ≤ 23:59:59.999 do dia da entrega em São Paulo (UTC−3 fixo).
- **% no prazo:** no prazo ÷ entregues com data, arredondado. "—" se não houver entregue com data. Verde ≥ 80%, amarelo 60–79%, vermelho < 60%.
- Tarefa com vários responsáveis conta para cada um; subtarefa conta como tarefa; tarefas, listas e espaços excluídos ficam de fora.
- Regras em `src/modulos/tarefas/regras/relatorio.ts` (testes em `relatorio.test.ts`); consulta em `servicos/relatorio.ts`.

## Integrações
- **Agenda:** tarefas com data podem ser enviadas ao Google Calendar do responsável (opção do usuário).
- **Acadêmico/Conteúdo:** uma tarefa pode ser vinculada a uma turma ou publicação e aparece na tela delas.

## Fora do escopo (v1)
Tarefas recorrentes, controle de tempo (time tracking), automações ("quando X então Y"), dependências entre tarefas, campos personalizados, importação do ClickUp. Ficam como candidatos para a v2.

## Situação da implementação
**F1a bloco 1 (feito):** espaços com membros, listas, status configuráveis, tarefas e subtarefas, responsáveis, datas, prioridade, visualização Lista com filtros, painel de detalhe e Minhas tarefas.

**F1a bloco 3 (em andamento):** relatório por pessoa (feito). Falta o 2FA.

**Próximos:** bloco 2 (Quadro Kanban, checklist, etiquetas, histórico, ordem fracionária) e o restante do bloco 3 (2FA). Pastas, comentários, anexos, calendário e texto formatado ficam para a F1c.

## Dúvidas em aberto
- As notificações por e-mail são necessárias ou bastam as notificações no sistema?
