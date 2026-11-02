# F3 — Agenda: especificação

- **Status:** Em revisão
- **Data:** 2026-11-02
- **Substitui:** a proposta anterior de `docs/modulos/agenda.md` (OAuth do Google na v1), que fica para depois.

## 1. Objetivo
A Agenda reúne, numa só tela, o **calendário da IPEMaster** (finais de semana da pós, eventos, formaturas, feriados), as **tarefas com entrega** de cada pessoa e a **agenda pessoal** dela no Google. Cada pessoa também leva o calendário da IPEMaster para o próprio Google Agenda.

**Critério de sucesso:** um colaborador lança de uma vez os 10 finais de semana de uma turma da pós, marcados como visíveis para professores. O professor da turma vê essas datas na Agenda da plataforma e no Google Agenda do celular (pela assinatura), junto com os compromissos pessoais dele, que ninguém mais vê.

## 2. Decisões do usuário (2026-11-02)
- A equipe usa **Gmail pessoal**. Por isso a v1 não usa OAuth do Google: com Gmail, o app precisa da verificação do Google para escopos de calendário. Até lá vale o limite de 100 usuários de teste, e a conexão expira a cada 7 dias. A v1 usa links iCal.
- Da agenda pessoal, o essencial é **ver** os compromissos. Criar eventos no Google fica para quando houver verificação.
- **Admin, gestor e colaborador** cadastram e editam o calendário da IPEMaster.
- **Professores** veem só os eventos marcados como "visível para professores".
- Os finais de semana da pós são lançados com **várias datas de uma vez**.

## 3. Escopo
**Entra:** tipos de evento, eventos institucionais (dia inteiro ou com horário, um ou vários dias), lançamento em lote, visões mês, semana e lista, camada de tarefas com entrega, agenda pessoal por link iCal (só leitura, até 5 por pessoa), link de assinatura `.ics` por pessoa, filtros salvos.

**Fica para depois:** OAuth do Google (criar eventos no Google, aulas na agenda do professor), eventos recorrentes no calendário institucional (o lote cobre o caso da pós), vínculo com turmas do Acadêmico (até lá, a turma é texto livre), convites, presença ou confirmação, notificações, agenda compartilhada da equipe e horário livre entre pessoas.

## 4. Modelo de dados
Convenções do projeto: ids `cuid`, `criadoEm`/`atualizadoEm`, tabelas `snake_case` no plural via `@@map`.

| Modelo | Campos | Observações |
|---|---|---|
| `TipoEvento` | id, nome (≤40, único), cor (hex), ordem (Int), ativo | Semente: Aulas da pós, Evento, Formatura, Feriado/Recesso, Reunião interna. Tipo inativo não aparece no formulário, mas os eventos dele continuam visíveis |
| `EventoInstitucional` | id, tipoId, titulo (≤150), turma (≤100)?, local (≤150)?, descricao (Text)?, dataInicio (`@db.Date`), dataFim (`@db.Date`), horaInicio ("HH:MM")?, horaFim?, visivelProfessores (bool, padrão false), loteId?, criadoPorId, excluidoEm?, criadoEm, atualizadoEm | Índices: (dataInicio, dataFim), (loteId), (tipoId) |
| `AgendaExterna` | id, usuarioId, nome (≤60), cor, urlCifrada (Text), ultimoSucessoEm?, ultimoErro (≤200)?, criadoEm, atualizadoEm | Até 5 por usuário |
| `AssinaturaAgenda` | usuarioId (PK), tokenHash (Char 64, único), criadoEm | Um link por pessoa. Gerar um novo troca o hash |

**Datas e horas:**
- `dataInicio` e `dataFim` são dias do calendário, sem fuso.
- `horaInicio` e `horaFim` estão no horário de São Paulo (UTC−3 fixo, como no resto do sistema).
- Sem hora = dia inteiro.
- Com hora, as duas são obrigatórias. Se o evento é de um dia só, `horaFim` > `horaInicio`.
- `dataFim` ≥ `dataInicio`, e um evento dura no máximo 31 dias.

## 5. Regras de negócio
1. Criar, editar ou excluir evento institucional exige `agenda:editar_institucional`. Excluir é lógico, e as três ações vão para a auditoria (`agenda.evento_criado`, `agenda.evento_editado`, `agenda.evento_excluido`; o lote gera uma linha só, com a quantidade).
2. Quem tem `agenda:ver_institucional` vê todos os eventos não excluídos. Quem tem só `agenda:ver_institucional_professor` vê apenas os que têm `visivelProfessores = true`.
3. **Lote:** um formulário cria de 1 a 30 eventos com os mesmos tipo, título-base, turma, local, horário e visibilidade. Cada período informa início e fim (o padrão é sábado e domingo). Com "numerar títulos", o título vira "<título> — 1", "— 2"… na ordem das datas. Os eventos recebem o mesmo `loteId`. Depois de criados, são independentes: editar um não muda os outros. O detalhe do evento lista os demais do lote.
4. **Tipos de evento:** só quem tem `agenda:gerenciar_tipos` cria, renomeia, troca a cor, reordena e desativa. Não há exclusão, só desativação.
5. **Agenda pessoal:**
   - Só o dono lê, edita ou remove (nem admin). Toda leitura filtra por `usuarioId = ator.id`.
   - A URL é aceita só com `https://` e host `calendar.google.com` (caminho começando com `/calendar/ical/`) ou `outlook.office365.com` / `outlook.live.com` (caminho com `/owa/calendar/`). Qualquer outro host é recusado, para impedir SSRF.
   - A URL é guardada cifrada (AES-256-GCM, chave derivada por HKDF de `BETTER_AUTH_SECRET`). A tela mostra só o host e os últimos 6 caracteres.
   - Ao salvar, o servidor testa a leitura. Se falhar, não salva e explica o motivo.
6. **Leitura do iCal:**
   - `fetch` com timeout de 8 s, até 5 MB, sem seguir redirecionamento para outro host.
   - Interpretação com `ical.js`, expandindo eventos recorrentes (RRULE e EXDATE) só dentro do intervalo pedido, com no máximo 2.000 ocorrências por agenda.
   - Cache em memória por agenda por 10 minutos.
   - Se falhar, a tela mostra o aviso "Não consegui ler <nome>", grava `ultimoErro` e mostra o resto normalmente. Um sucesso grava `ultimoSucessoEm` e limpa o erro.
   - Os eventos pessoais nunca são gravados no banco nem em log.
7. **Assinatura `.ics`:**
   - Endereço: `GET /api/agenda/assinatura/<token>.ics`. O token tem 32 bytes aleatórios em base64url, e o banco guarda só o SHA-256.
   - O arquivo traz os eventos institucionais de 90 dias para trás até 365 dias para frente, filtrados pelo papel do dono do token (regra 2).
   - Usuário inativo, ou sem permissão de ver o calendário institucional, recebe 404.
   - Nunca inclui a agenda pessoal nem tarefas.
   - Resposta: `Content-Type: text/calendar; charset=utf-8` e `Cache-Control: private, max-age=900`.
   - O `UID` de cada evento é `<id>@ipemaster`. A data de início de evento de dia inteiro vai como `VALUE=DATE`, com `DTEND` exclusivo (dia seguinte ao fim). Eventos com hora levam `TZID=America/Sao_Paulo`.
   - "Gerar novo link" invalida o anterior na hora.
8. **Camada de tarefas:** mostra as tarefas abertas com `dataEntrega` em que o usuário é responsável, com as mesmas regras de visibilidade do módulo Tarefas. Clicar abre a tarefa na lista dela. As concluídas não aparecem.

## 6. Permissões
Novas em `src/lib/permissoes.ts`:

| Permissão | admin | gestor | colaborador | professor |
|---|---|---|---|---|
| `agenda:usar` (tela, agenda pessoal, assinatura) | ✅ | ✅ | ✅ | ✅ |
| `agenda:ver_institucional` | ✅ | ✅ | ✅ | — |
| `agenda:ver_institucional_professor` | — | — | — | ✅ |
| `agenda:editar_institucional` | ✅ | ✅ | ✅ | — |
| `agenda:gerenciar_tipos` | ✅ | ✅ | — | — |

## 7. Telas
| Rota | Conteúdo |
|---|---|
| `/agenda` | Calendário. Alterna **Mês / Semana / Lista** (`?visao=`, `?data=AAAA-MM-DD`), com Hoje e setas para navegar. Barra de camadas: IPEMaster (filtro por tipo e por turma), Minhas tarefas, cada agenda pessoal (liga/desliga). Filtros e visão salvos no cookie `agenda_filtro` até limpar. Botões "Novo evento" e "Lançar várias datas" para quem edita |
| `/agenda?evento=<id>` | Painel lateral com o detalhe do evento institucional. Quem pode edita ou exclui ali. Mostra os outros eventos do mesmo lote |
| `/agenda/configuracoes` | **Minhas agendas:** colar link iCal, com instruções passo a passo para Google (Configurações → sua agenda → "Endereço secreto no formato iCal") e Outlook; nome, cor, remover, estado da última leitura. **Levar para o Google:** copiar link de assinatura, instruções (Google Agenda → Outras agendas → + → "Do URL"), gerar novo link. **Tipos de evento** (quem gerencia) |

**Mês:** grade de domingo a sábado. Eventos de vários dias aparecem como faixa contínua por semana. Cada dia mostra até 3 itens e "+N", que abre o dia. **Semana:** colunas por dia, com os de dia inteiro no topo e os com hora posicionados das 6h às 23h. **Lista:** próximos 60 dias agrupados por dia (é a visão padrão no celular).

Cores: o evento institucional usa a cor do tipo, a tarefa é roxa (#5F45F4) com ícone de tarefa, e a agenda pessoal usa a cor escolhida, em traço mais leve.

O item **Agenda** do menu principal deixa de ser "em breve" para quem tem `agenda:usar`.

## 8. Arquitetura
Módulo `src/modulos/agenda/{regras,servicos,acoes,componentes,esquemas}`:
- `regras/periodo.ts`: validação de período e horário, grade do mês e da semana, distribuição de eventos de vários dias em faixas, conversão para instantes UTC. Funções puras com testes.
- `regras/ics.ts`: gerar o `.ics` da assinatura (escape, dobra de linha em 75 octetos, `VALUE=DATE`, `DTEND` exclusivo). Funções puras com testes.
- `regras/url-ical.ts`: validação de host e caminho permitidos. Testada.
- `servicos/cifra.ts`: cifrar e decifrar a URL (AES-256-GCM, HKDF). Testada com ida e volta e com adulteração detectada.
- `servicos/ical-externo.ts`: buscar, limitar, interpretar e expandir com `ical.js`, com cache em memória. Testado com arquivos `.ics` de exemplo (sem rede).
- `servicos/eventos.ts`, `servicos/tipos.ts`, `servicos/agendas-externas.ts`, `servicos/assinatura.ts`: acesso ao banco com permissão checada no servidor.
- `app/api/agenda/assinatura/[arquivo]/route.ts`: o feed.

A decisão de derivar a chave de `BETTER_AUTH_SECRET` (em vez de criar uma variável nova) vira a ADR `0005-cifra-de-links-de-agenda.md`. **Consequência:** trocar `BETTER_AUTH_SECRET` invalida os links salvos, e as pessoas precisam colá-los de novo (a tela avisa).

Nova dependência: `ical.js` (versão exata).

## 9. Entregas
Cada entrega vai para `teste` e é validada antes da seguinte:
1. **Calendário da IPEMaster:** permissões, tipos (com semente), eventos, lote, telas mês, semana e lista, painel do evento, camada de tarefas, filtros salvos, menu.
2. **Integração com o Google:** agendas pessoais por iCal (cifra, validação de URL, leitura e cache), assinatura `.ics`, tela de configurações e ADR 0005.

## 10. Testes
- **Vitest:**
  - períodos: dia inteiro, vários dias, virada de mês e ano, horário inválido, limite de 31 dias;
  - grade e faixas do mês;
  - lote: numeração e ordem;
  - `.ics` gerado: datas, `DTEND` exclusivo, escape e dobra;
  - URL permitida ou recusada (outros hosts, `http`, IP, porta);
  - cifra: ida e volta, adulteração;
  - leitura de `.ics` de exemplo com RRULE e EXDATE, fuso e dia inteiro;
  - permissões por papel.
- **Homologação:** roteiro curto de teste manual para o usuário a cada entrega, só com dados fictícios.

## 11. Riscos
- **O Google atualiza assinaturas `.ics` de tempos em tempos (pode levar horas).** A tela de configurações avisa isso. A Agenda da plataforma é sempre imediata.
- **Link iCal secreto vazado dá leitura da agenda da pessoa.** Fica cifrado, nunca aparece inteiro nem em log, e a pessoa pode trocá-lo no Google a qualquer momento.
- **Agenda pessoal muito grande ou lenta:** há limites de tamanho, tempo e ocorrências, e o cache de 10 minutos evita repetir a busca.
- **Várias instâncias do app teriam caches separados.** Hoje é uma instância só, então isso é aceitável.
