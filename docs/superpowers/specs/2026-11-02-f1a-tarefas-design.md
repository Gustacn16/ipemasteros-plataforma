# F1a — Tarefas: especificação

- **Status:** Proposto
- **Data:** 2026-11-02
- **Base:** `docs/modulos/tarefas.md` e `docs/04-seguranca-permissoes.md`. Onde este documento divergir deles, vale este, e os dois são atualizados durante a implementação.

## 1. Objetivo
Substituir o ClickUp na operação da IPEMaster. A equipe **começa do zero**, sem importar nada do ClickUp. A troca acontece quando os 3 blocos desta fase estiverem na homologação e validados.

Critério de sucesso: um gestor cadastra uma demanda, atribui a uma pessoa com data de entrega e checklist, a pessoa acompanha pelo quadro e por "Minhas tarefas", conclui, e o relatório mostra se a entrega foi no prazo.

## 2. Vocabulário
| Termo da operação | No sistema |
|---|---|
| Departamento | **Espaço** (ex.: Marketing, Comercial, Acadêmico) |
| Grupo de demandas | **Lista** dentro do espaço (ex.: Campanhas) |
| Demanda | **Tarefa** (ex.: "Subir campanha de Black Friday paciente modelo") |

## 3. Escopo
**Entra:** espaços, listas, status por lista, tarefas, subtarefas (1 nível), responsáveis, datas de início e entrega, prioridade, checklist, etiquetas, histórico de alterações, visualizações Lista e Quadro (Kanban), Minhas tarefas, relatório por pessoa, 2FA obrigatório para admin e gestor.

**Fica para a F1c ou depois:** pastas, comentários e @menções, notificações, anexos, descrição com texto formatado, visualização Calendário, gráficos e exportação do relatório, importação do ClickUp, tarefas recorrentes, controle de tempo, automações, dependências, campos personalizados.

## 4. Modelo de dados
Convenções do projeto: ids `cuid`, `criadoEm`/`atualizadoEm`, tabelas `snake_case` no plural via `@@map`, datas em UTC.

| Modelo | Campos | Observações |
|---|---|---|
| `Espaco` | id, nome (≤80), cor (hex), ordem (Decimal), excluidoEm? | Nome único entre espaços não excluídos |
| `MembroEspaco` | espacoId, usuarioId, criadoEm | PK composta |
| `Lista` | id, espacoId, nome (≤80), ordem (Decimal), excluidoEm? | |
| `StatusLista` | id, listaId, nome (≤40), cor, tipo (`aberto`/`em_andamento`/`concluido`), ordem (Decimal) | |
| `Tarefa` | id, listaId, tarefaPaiId?, titulo (≤200), descricao (Text, texto simples)?, statusId, prioridade (`urgente`/`alta`/`normal`/`baixa`, padrão `normal`), dataInicio?, dataEntrega?, ordem (Decimal), concluidaEm?, criadoPorId, excluidoEm? | Índices: (listaId, statusId, ordem), (dataEntrega), (concluidaEm) |
| `TarefaResponsavel` | tarefaId, usuarioId | PK composta; índice por usuarioId |
| `ItemChecklist` | id, tarefaId, texto (≤200), concluido, ordem (Decimal) | |
| `Etiqueta` | id, espacoId, nome (≤40), cor | Nome único por espaço |
| `TarefaEtiqueta` | tarefaId, etiquetaId | PK composta |
| `HistoricoTarefa` | id, tarefaId, usuarioId, campo (`status`/`responsaveis`/`dataInicio`/`dataEntrega`/`prioridade`/`lista`), valorAntes (JSON)?, valorDepois (JSON)?, criadoEm | Somente inserção |
| `PreferenciaVisualizacao` | usuarioId, listaId, modo (`lista`/`quadro`) | Lembra a visualização escolhida |

**Datas de entrega:** `dataEntrega` é uma data sem hora (`@db.Date`). "No prazo" significa `concluidaEm` ≤ fim do dia `dataEntrega` em `America/Sao_Paulo` (23:59:59.999 local, convertido para UTC no cálculo).

**Ordem:** `Decimal(20,10)`. Mover um item para entre A e B grava `(A+B)/2`. Quando a diferença entre vizinhos fica menor que 1e-6, a lista inteira é renumerada (1, 2, 3…) numa transação.

**2FA:** campos e tabela exigidos pelo plugin `twoFactor` do Better Auth (`twoFactorEnabled` em `Usuario` e tabela de segredos/códigos de recuperação), via migration.

## 5. Regras de negócio
1. Lista nova recebe os status *A fazer* (aberto), *Em andamento* (em_andamento) e *Concluído* (concluido).
2. Toda lista mantém ao menos um status `aberto` e um `concluido`. A ação que deixaria a lista sem um deles é recusada.
3. Excluir um status exige um status de destino da mesma lista para as tarefas que estão nele.
4. Entrar num status `concluido` grava `concluidaEm = agora`. Sair dele grava `concluidaEm = null`.
5. Subtarefa: `tarefaPaiId` aponta para uma tarefa sem pai. A subtarefa tem sempre a mesma `listaId` da tarefa pai. Mover a tarefa pai de lista move as subtarefas junto.
6. Concluir tarefa com subtarefas abertas pede confirmação na tela. O servidor aceita com `confirmarSubtarefasAbertas: true`. As subtarefas não mudam de status.
7. Responsável precisa ser membro do espaço (ou admin/gestor). Quem sai do espaço continua como responsável das tarefas existentes, que mostram o aviso "não é mais membro".
8. Toda mudança de status, responsáveis, datas, prioridade ou lista grava uma linha em `HistoricoTarefa` na mesma transação.
9. Excluir espaço, lista ou tarefa é lógico (`excluidoEm`). Excluir o espaço ou a lista esconde o conteúdo, mas não apaga. Tarefas excluídas não entram no relatório.
10. A data de início, se houver, não pode ser posterior à data de entrega.

## 6. Permissões
Novas permissões em `src/lib/permissoes.ts`:

| Permissão | admin | gestor | colaborador | professor |
|---|---|---|---|---|
| `tarefas:gerenciar_espacos` (criar, editar, excluir, membros) | ✅ | ✅ | — | — |
| `tarefas:gerenciar_listas` (listas, status, etiquetas) | ✅ | ✅ | ✅ 🔸 | — |
| `tarefas:ver_todos_espacos` | ✅ | ✅ | — | — |
| `tarefas:usar` (ver, criar, editar tarefas) | ✅ | ✅ | ✅ 🔸 | ✅ 🔸 |
| `tarefas:ver_relatorio_equipe` | ✅ | ✅ | — | — |

🔸 Regras por registro, no serviço do módulo (`src/modulos/tarefas/servicos/acesso.ts`):
- Colaborador só acessa espaços em que é membro.
- Professor não navega em espaços: vê e altera status e checklist só das tarefas em que é responsável.
- Excluir tarefa: admin, gestor ou quem a criou.
- Relatório sem `tarefas:ver_relatorio_equipe`: só a linha do próprio usuário.

Toda Server Action valida a entrada com Zod e checa acesso no servidor antes de ler ou gravar. Acesso negado a um registro responde como "não encontrado", para não revelar que ele existe.

**Auditoria:** a criação, exclusão e mudança de membros de espaço gera `registrarAuditoria()`. As mudanças de tarefa vão para o `HistoricoTarefa`, não para o log de auditoria.

## 7. Telas
| Rota | Conteúdo |
|---|---|
| `/tarefas/minhas` | Tarefas abertas do usuário em 4 grupos: Atrasadas, Hoje, Próximos 7 dias e Sem data (dias em `America/Sao_Paulo`). Também é a única tela do professor |
| `/tarefas/espacos/[espacoId]/configuracoes` | Nome, cor, membros e etiquetas |
| `/tarefas/listas/[listaId]` | Cabeçalho com nome da lista, alternância **Lista/Quadro**, filtros (responsável, etiqueta, prioridade, atrasadas), "+ Nova tarefa" e configuração dos status |
| `/tarefas/listas/[listaId]?tarefa=[id]` | Painel lateral com o detalhe da tarefa (tela cheia no celular) |
| `/tarefas/relatorio` | Relatório (seção 8) |
| `/perfil/seguranca` | Ativar 2FA e ver códigos de recuperação |

**Barra lateral:** Início, Minhas tarefas, Relatório e a árvore de espaços e listas a que o usuário tem acesso, com "+ Novo espaço" para quem pode.

**Visualização Lista:** tabela agrupada por status, com colunas título, responsáveis, entrega (vermelha se atrasada), prioridade e etiquetas. As subtarefas aparecem recolhidas sob a tarefa pai.

**Visualização Quadro:** uma coluna por status, na ordem da lista. Cada cartão mostra título, avatares dos responsáveis, data de entrega, prioridade e progresso do checklist (ex.: 2/5). Arrastar entre colunas muda o status. Arrastar dentro da coluna reordena. O cartão muda na hora e volta para a posição anterior, com aviso, se o servidor recusar. Feito com `@dnd-kit`, com suporte a toque e teclado.

**Detalhe da tarefa:** título editável, status, responsáveis, datas, prioridade, etiquetas, descrição, subtarefas (criar e concluir), checklist (adicionar, marcar, reordenar e remover) e histórico em ordem cronológica.

## 8. Relatório
Filtros: período (esta semana, este mês, mês passado ou intervalo livre; padrão: este mês) e espaço (padrão: todos os que o usuário pode ver).

Por pessoa (usuários ativos com ao menos uma tarefa no escopo):

| Coluna | Definição |
|---|---|
| Abertas | Tarefas não excluídas, sem `concluidaEm`, em que a pessoa é responsável. Contadas no momento atual, sem considerar o período |
| Atrasadas agora | Abertas com `dataEntrega` anterior a hoje (em `America/Sao_Paulo`) |
| Entregues | `concluidaEm` dentro do período |
| No prazo | Entregues com `dataEntrega` e `concluidaEm` ≤ fim do dia `dataEntrega` (`America/Sao_Paulo`) |
| % no prazo | No prazo ÷ entregues **com** `dataEntrega`. Mostra "—" se o divisor for 0. Cores: 🟢 ≥ 80%, 🟡 60–79%, 🔴 < 60% |

- Tarefa com vários responsáveis conta para cada um.
- Subtarefa conta como tarefa.
- Clicar na pessoa lista as tarefas dela que entraram no cálculo, com status de prazo.
- O cálculo é feito no banco a cada consulta, com as regras de data em funções puras testadas em `src/modulos/tarefas/servicos/prazo.ts`.

## 9. 2FA
- Plugin `twoFactor` do Better Auth (TOTP, compatível com Google Authenticator) e 10 códigos de recuperação de uso único.
- Admin e gestor sem 2FA ativo são levados a `/perfil/seguranca` após o login e não acessam outras telas até ativar.
- Para os demais papéis, o 2FA é opcional.
- Ativar, desativar e usar código de recuperação geram auditoria.
- Mudar alguém para admin ou gestor exige que a pessoa ative o 2FA no próximo acesso.
- Um admin pode desativar o 2FA de outro usuário em `/admin/usuarios` (auditado), para o caso de celular perdido. Ninguém desativa o 2FA obrigatório do próprio papel.

## 10. Entregas
Cada bloco é publicado na branch `teste` e validado antes do seguinte:

1. **Estrutura e tarefas:** modelos e migration; espaços, membros, listas e status; tarefas, subtarefas, responsáveis, datas e prioridade; visualização Lista; detalhe da tarefa; Minhas tarefas; permissões.
2. **Dia a dia:** Quadro (Kanban), checklist, etiquetas, histórico de alterações e preferência de visualização.
3. **Gestão:** relatório e 2FA.

## 11. Testes
- **Vitest:** regras 1–6 e 10 de status e subtarefa; cálculo de prazo (entrega às 23h59 e às 00h01 de Brasília, sem data; o Brasil não tem horário de verão desde 2019, então o deslocamento é fixo em UTC−3); "Minhas tarefas" (limites de Hoje e 7 dias); ordem fracionária e renumeração; matriz de permissões e regras por registro.
- **Playwright:** criar espaço → lista → tarefa com responsável e checklist → arrastar no quadro até Concluído → conferir no relatório. Colaborador não vê espaço de que não é membro. Admin sem 2FA é levado à configuração.
- **Homologação:** roteiro curto de teste manual entregue ao usuário a cada bloco. Só dados fictícios.

## 12. Riscos
- **Arrastar no celular:** o `@dnd-kit` com sensor de toque e um pequeno atraso evita conflito com a rolagem. Validar na homologação com um celular real.
- **Bloqueio por 2FA:** se um admin perder o celular e os códigos, outro admin pode desativar o 2FA dele (auditado). Com um único admin, o caminho é o suporte técnico via banco, documentado no runbook.
