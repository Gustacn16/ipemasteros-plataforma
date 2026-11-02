# Módulo: Agenda

## Objetivo
A Agenda reúne, numa só tela, o **calendário da IPEMaster** (finais de semana da pós, eventos, formaturas, feriados), as **tarefas com entrega** de cada pessoa e a **agenda pessoal** dela no Google. Cada pessoa também leva o calendário da IPEMaster para o próprio Google Agenda.

Especificação: `docs/superpowers/specs/2026-11-02-agenda-design.md`.

**Critério de sucesso:** um colaborador lança de uma vez os 10 finais de semana de uma turma da pós, marcados como visíveis para professores. O professor da turma vê essas datas na Agenda da plataforma e no Google Agenda do celular (pela assinatura), junto com os compromissos pessoais dele, que ninguém mais vê.

## Decisões
- A equipe usa Gmail pessoal. Por isso a v1 **não usa OAuth do Google** (exigiria verificação do Google, com limite de 100 usuários de teste e conexão que expira a cada 7 dias). A v1 usa links iCal.
- Da agenda pessoal, o essencial é **ver** os compromissos. Criar eventos no Google fica para quando houver verificação.
- Admin, gestor e colaborador cadastram e editam o calendário da IPEMaster. Professores veem só os eventos marcados como "visível para professores".
- Os finais de semana da pós são lançados com várias datas de uma vez.

## Entidades
| Entidade | Campos principais |
|---|---|
| `TipoEvento` | id, nome (até 40, único), cor, ordem, ativo. Semente: Aulas da pós, Evento, Formatura, Feriado/Recesso, Reunião interna |
| `EventoInstitucional` | id, tipoId, titulo (até 150), turma? (texto livre, até 100), local? (até 150), descricao?, dataInicio, dataFim, horaInicio?, horaFim?, visivelProfessores (padrão não), loteId?, criadoPorId, excluidoEm? |
| `AgendaExterna` (entrega 2) | id, usuarioId, nome (até 60), cor, urlCifrada, ultimoSucessoEm?, ultimoErro? |
| `AssinaturaAgenda` (entrega 2) | usuarioId, tokenHash (SHA-256, único), criadoEm |

**Datas e horas:** `dataInicio` e `dataFim` são dias do calendário, sem fuso. `horaInicio` e `horaFim` estão no horário de São Paulo (UTC−3 fixo). Sem hora, o evento é de dia inteiro. Com hora, as duas são obrigatórias, e num evento de um dia só a hora final é depois da inicial. `dataFim` não pode ser antes de `dataInicio`, e um evento dura no máximo 31 dias.

## Telas
- **`/agenda`:** calendário com as visões **Mês**, **Semana** e **Lista** (`?visao=`, `?data=AAAA-MM-DD`), botão Hoje e setas. A Lista mostra os próximos 60 dias agrupados por dia e é a visão padrão no celular.
  - **Mês:** grade de domingo a sábado. Evento de vários dias vira faixa contínua em cada semana. Cada dia mostra até 3 itens e "+N", que abre o dia.
  - **Semana:** uma coluna por dia, com os eventos de dia inteiro no topo e os com horário posicionados das 6h às 23h.
  - **Barra de camadas:** IPEMaster (com filtro por tipo e por turma), Minhas tarefas e Minhas agendas (cada agenda pessoal liga e desliga). A visão e os filtros ficam salvos no cookie `agenda_filtro` (agendas desligadas em `desligadas`).
  - **Agenda pessoal no calendário:** os compromissos usam a cor da agenda com traço mais leve (fundo com 12% da cor e borda tracejada) e não abrem nada ao clicar. São convertidos para dia e hora de São Paulo no servidor; no dia inteiro, o fim do iCal é exclusivo (o último dia é o fim menos 1). A leitura só acontece se a pessoa tem agendas ligadas e roda junto com a consulta do calendário da IPEMaster. Agenda que falha mostra "Não consegui ler <nome>" acima do calendário, com link para Configurações, e o resto aparece normal.
  - Quem edita vê os botões "Novo evento" e "Lançar várias datas".
- **`/agenda?evento=<id>`:** painel lateral com o detalhe do evento. Quem pode editar altera ou exclui ali. Mostra os outros eventos do mesmo lote.
- **`/agenda/configuracoes`:** link "Configurações" no cabeçalho da Agenda.
  - **Minhas agendas** (todos): aviso fixo "Só você vê esses compromissos.", passo a passo do Google (Configurações → clique na sua agenda → Integrar agenda → "Endereço secreto no formato iCal" → copiar) e do Outlook (Calendários compartilhados → Publicar um calendário → link ICS), formulário com nome, cor e link (o servidor testa antes de salvar), e a lista com cor, nome, endereço mascarado, "Lida às HH:MM" ou o erro, Salvar e Remover (com confirmação). Até 5 agendas. Aviso: se a plataforma trocar a chave de segurança, é preciso colar o link de novo.
  - **Levar para o Google** (quem vê o calendário da IPEMaster): botão Gerar link / Gerar novo link (o novo pede confirmação, porque o anterior para de funcionar na hora). **O link é exibido uma vez só**, logo depois de gerado, com Copiar (se a área de transferência falhar, o texto fica selecionado para copiar à mão). Instruções: Google Agenda → Outras agendas → + → "Do URL" → colar. Aviso "O Google pode levar algumas horas para atualizar".
  - **Tipos de evento** (só `agenda:gerenciar_tipos`): cor, nome, Salvar, subir e descer, Ativo/Inativo e criação de tipo novo.
- **Cores:** o evento usa a cor do seu tipo. A tarefa é roxa (#5F45F4), com ícone de tarefa. A agenda pessoal usa a cor escolhida, em traço mais leve.
- O item **Agenda** do menu principal fica ativo para quem tem `agenda:usar`.

## Regras de negócio
1. Criar, editar ou excluir evento exige `agenda:editar_institucional`. A exclusão é lógica. As três ações vão para a auditoria (`agenda.evento_criado`, `agenda.evento_editado`, `agenda.evento_excluido`; o lote gera uma linha só, com a quantidade).
2. Quem tem `agenda:ver_institucional` vê todos os eventos não excluídos. Quem tem só `agenda:ver_institucional_professor` vê apenas os marcados como visíveis para professores. Evento fora do alcance responde "Não encontrado.".
3. **Lote:** cria de 1 a 30 eventos com o mesmo tipo, título-base, turma, local, horário e visibilidade. Cada período tem início e fim (o padrão é sábado e domingo). Com "numerar títulos", o título vira "<título> — 1", "— 2" e assim por diante, na ordem das datas. Todos recebem o mesmo `loteId`, mas depois de criados são independentes: editar um não muda os outros.
4. **Tipos de evento:** só quem tem `agenda:gerenciar_tipos` cria, renomeia, troca a cor, reordena e desativa. Não existe exclusão, só desativação. Tipo inativo some do formulário, mas os eventos dele continuam visíveis. O nome do tipo não pode se repetir. Toda alteração vai para a auditoria (`agenda.tipo_alterado`).
5. **Camada de tarefas:** mostra as tarefas abertas com data de entrega em que a pessoa é responsável, com as mesmas regras de visibilidade do módulo Tarefas. Clicar abre a tarefa na lista dela. As concluídas não aparecem.
   Para professores o item da tarefa abre `/tarefas/minhas` (e não a lista da tarefa), porque professores não navegam pelos espaços.
6. **Agenda pessoal (entrega 2):**
   - Só a própria pessoa lê, edita ou remove (nem o admin).
   - Só são aceitos links `https` de Google Calendar e Outlook, para impedir que o servidor seja usado para acessar endereços internos.
   - O link é guardado cifrado, e a tela mostra só o endereço e os últimos 6 caracteres.
   - Ao salvar, o servidor testa a leitura e, se falhar, explica o motivo.
   - A leitura tem limite de tempo (8 s), de tamanho (5 MB) e de ocorrências (2.000), com cache de 10 minutos. A interpretação roda em worker, com no máximo 4 leituras de agenda ao mesmo tempo no servidor. Se uma agenda falhar, a tela avisa "Não consegui ler <nome>" e mostra o resto.
   - Os eventos pessoais nunca são gravados no banco nem em log. Cada pessoa pode ter até 5 agendas.
7. **Assinatura `.ics` (entrega 2):**
   - Endereço `/api/agenda/assinatura/<token>.ics`. O banco guarda só o hash do token, por isso o link completo é mostrado uma vez só, na hora em que é gerado.
   - Traz os eventos da IPEMaster de 90 dias atrás até 365 dias à frente, filtrados pelo papel do dono. Nunca traz agenda pessoal nem tarefas.
   - Usuário inativo ou sem permissão recebe 404. "Gerar novo link" invalida o anterior na hora.
   - O Google pode levar horas para atualizar uma assinatura. A Agenda da plataforma é sempre imediata.

## Permissões
| Permissão | admin | gestor | colaborador | professor |
|---|---|---|---|---|
| `agenda:usar` (tela, agenda pessoal, assinatura) | sim | sim | sim | sim |
| `agenda:ver_institucional` | sim | sim | sim | não |
| `agenda:ver_institucional_professor` | não | não | não | sim |
| `agenda:editar_institucional` | sim | sim | sim | não |
| `agenda:gerenciar_tipos` | sim | sim | não | não |

A checagem é feita no servidor, em toda página, Server Action e Route Handler. Detalhes em `docs/04-seguranca-permissoes.md`.

## Integrações
- **Tarefas:** a camada de tarefas lê as entregas do módulo Tarefas e abre a tarefa na lista dela.
- **Google Agenda / Outlook (entrega 2):** leitura por link iCal secreto e assinatura `.ics` do calendário da IPEMaster. A cifra dos links vira a ADR `0005-cifra-de-links-de-agenda.md`: a chave deriva de `BETTER_AUTH_SECRET`, então trocar esse segredo obriga as pessoas a colarem os links de novo.
- **Acadêmico:** por enquanto a turma do evento é texto livre. O vínculo com as turmas do Acadêmico fica para depois.

## Fora do escopo (v1)
OAuth do Google (criar eventos no Google, aulas na agenda do professor), eventos recorrentes no calendário da IPEMaster (o lote cobre o caso da pós), vínculo com turmas do Acadêmico, convites, presença ou confirmação, notificações, agenda compartilhada da equipe e horário livre entre pessoas.

## Situação da implementação
**Entrega 1, calendário da IPEMaster (feita, aguardando validação na homologação):** permissões, tipos de evento com semente e tela de gestão, eventos, lançamento em lote, visões Mês, Semana e Lista, painel do evento, camada de tarefas, filtros salvos e item no menu.

**Entrega 2, integração com o Google por iCal (feita, aguardando validação na homologação):** agendas pessoais por link iCal (cifra, validação de endereço, leitura em worker e cache), camada pessoal no calendário, assinatura `.ics`, as seções "Minhas agendas" e "Levar para o Google" em `/agenda/configuracoes` e a ADR 0005.

**Carga inicial das aulas (migration `20261104030000_agenda_aulas_2026_2027`):** 127 eventos do tipo "Aulas da pós" e "Formatura", visíveis para professores, tirados dos calendários enviados pela coordenação: Transplante Capilar Turma 3 e Cíclica (2026), Turma 4 (2026/2–2027/1), Turma 5 (2027) e Psiquiatria Clínica (out/2026–out/2027). Cada turma é um lote (`lote_tc_t3`, `lote_tc_t4`, `lote_tc_t5`, `lote_psq`). Depois da carga, as datas se editam normalmente na Agenda. A escala da equipe (logística) não entrou.

**Depois (fora da v1):** OAuth do Google, para criar eventos no Google e levar tarefas e aulas para a agenda de cada pessoa.
