# Módulo: Nexu

## Objetivo
Assistente de IA dentro do IPEMaster OS. Responde perguntas sobre os dados da plataforma (Tarefas, Agenda, Acadêmico, Conteúdo e Comercial) e **propõe ações que a pessoa confirma com um clique**. Nada é executado sem a confirmação.

Especificação da N1: `docs/superpowers/specs/2026-11-17-nexu-n1-design.md`. Decisão de arquitetura: `docs/decisoes/0006-ia-claude-no-sistema.md`.

## Vocabulário
| Termo | No sistema |
|---|---|
| Conversa com o assistente | `ConversaNexu` |
| Mensagem (pergunta, resposta, chamadas de ferramenta) | `MensagemNexu` |
| Ação que o Nexu sugere e a pessoa confirma | `PropostaNexu` |
| Registro de uma chamada à API de IA (custo, sem texto) | `UsoIa` |
| Modelo e limites de gasto | `ConfiguracaoIa` |

## Entidades
| Entidade | Campos principais |
|---|---|
| `ConversaNexu` | id, usuarioId, titulo (≤120, a 1ª pergunta cortada), criadoEm, atualizadoEm |
| `MensagemNexu` | id, conversaId, papel (`usuario`/`assistente`), conteudo (Json: os blocos exatos da API, incluindo `tool_use` e `tool_result`), ordem, criadoEm. Cascade a partir da conversa |
| `PropostaNexu` | id, conversaId, usuarioId, toolUseId, tipo (`criar_tarefa`/`mudar_status_tarefa`/`adicionar_checklist`/`criar_evento`/`criar_post`/`registrar_venda`), dados (Json), resumo (≤500), status (`pendente`/`executando`/`confirmada`/`recusada`/`falhou`), erro?, resultadoId?, resultadoUrl?, decididaEm?. Cascade a partir da conversa |
| `UsoIa` | id, origem (`nexu`, depois `whatsapp`), usuarioId?, inicioPergunta (true na 1ª chamada de cada pergunta), modelo, tokensEntrada, tokensCacheEscrita, tokensCacheLeitura, tokensSaida, custoMicroUsd, criadoEm. **Sem texto** e não é apagada na limpeza de 90 dias |
| `ConfiguracaoIa` | linha única: modelo, limiteMensalMicroUsd, perguntasPorDia, atualizadoPorId?, atualizadoEm. A migration cria com `claude-haiku-5-5`, 20.000.000 (US$ 20) e 50 |

Conversa, mensagem e proposta usam exclusão **física** (LGPD), não `excluidoEm`.

## Regras de negócio
1. **Acesso:** `nexu:usar` no servidor, em todo Route Handler e Server Action. Conversa e proposta só podem ser lidas ou alteradas pelo dono, inclusive para o admin. Configuração exige `nexu:configurar`.
2. **Limite do dia:** 50 perguntas por pessoa (editável). Conta as linhas de `UsoIa` com `inicioPergunta` no dia de São Paulo. Pergunta que falha antes da API responder não conta, e apagar conversa não devolve perguntas.
3. **Limite do mês:** US$ 20 (editável), somando `UsoIa.custoMicroUsd` de **todas as origens** no mês de São Paulo. O futuro agente do WhatsApp divide o mesmo limite. Checado antes de cada pergunta; se estourar no meio, a pergunta termina e as próximas são recusadas.
4. **Tamanho da conversa:** no máximo 30 perguntas. Depois, o Nexu pede para começar uma nova ("Esta conversa ficou longa. Comece uma nova conversa para continuar.").
5. **Loop de ferramentas:** até 8 chamadas de ferramenta por pergunta e 60 s por pergunta. Ferramentas pedidas juntas rodam em paralelo. Erro de ferramenta vira `tool_result` com `is_error` e mensagem curta.
6. **Pedido à API:** prompt de sistema fixo (cache) → ferramentas do papel em ordem fixa (cache) → histórico → bloco de contexto (data/hora em São Paulo, nome, papel e tela atual) → pergunta. Modelo padrão `claude-haiku-5-5`, `max_tokens` 4000, `effort: "low"`.
7. **Proposta:** a ferramenta valida os dados com Zod e grava a `PropostaNexu` `pendente`. Não executa nada. A tela recebe o evento `proposta` e mostra o cartão.
8. **Confirmar:** a Server Action faz a transição **atômica** `pendente → executando`, conferindo o dono. Quem perde a corrida recebe "Esta proposta já foi decidida.". Depois revalida os dados, chama o serviço do módulo **como a pessoa que confirmou** (o serviço refaz a checagem de permissão) e marca `confirmada` (com `resultadoUrl`) ou `falhou` (com mensagem amigável). Grava a auditoria `nexu.proposta_confirmada`. A decisão entra na conversa como mensagem do usuário, para o modelo saber o que aconteceu.
9. **Recusar:** marca `recusada`. Proposta pendente de conversa antiga continua confirmável enquanto a conversa existir.
10. **Recusa do modelo** (`stop_reason: "refusal"`): "Não consegui responder a isso. Tente reformular.".
11. **Limpeza:** apaga conversas com `atualizadoEm` de mais de 90 dias (mensagens e propostas vão em cascata). Roda no cron diário `importar-meta-ads`, dentro de `try/catch`, e é idempotente.
12. **Markdown:** a resposta é exibida como markdown simples, sem HTML. **Imagens são bloqueadas** e links só valem para `http`, `https`, `mailto` e caminhos relativos (evita exfiltração de dados por imagem ou link).
13. **Dados de aluno:** nenhuma ferramenta devolve e-mail, telefone, CRM, UF do CRM nem observações.

## Ferramentas
A lista enviada à API é montada no servidor a partir das permissões do papel; ferramenta sem permissão nem é enviada. Listas têm no máximo 50 itens e informam o total.

**Consultas**
| Ferramenta | Permissão | Observações |
|---|---|---|
| `buscar_tarefas` | `tarefas:usar` | Respeita os espaços em que a pessoa é membro |
| `relatorio_tarefas_equipe` | `tarefas:ver_relatorio_equipe` | Abertas, atrasadas e concluídas por pessoa |
| `ver_agenda` | `agenda:ver_institucional` | Mesma regra de visibilidade do filtro da agenda. Período de até 62 dias |
| `turmas_e_formaturas` | `academico:ver` | Turmas, datas de formatura e alunos ativos |
| `buscar_aluno` | `academico:ver` | Só nome, turma, situação, início e formatura |
| `calendario_conteudo` | `conteudo:usar` | Posts do período com etapa, canal, responsável |
| `metricas_instagram` | `conteudo:usar` | Números do mês e melhores posts |
| `vendas_e_metas` | `comercial:ver` | **Sem nome de cliente.** Vendedor vê só as próprias; a equipe depende de `comercial:ver_equipe` (regra do serviço) |
| `produtos` | `comercial:ver` | Catálogo e preços |
| `buscar_pessoas` | `nexu:usar` | Nome → id, nome e papel de usuário ativo |

**Ações (gravam proposta; o serviço só roda ao confirmar)**
| Ferramenta | Permissão | Serviço chamado ao confirmar |
|---|---|---|
| `propor_criar_tarefa` | `tarefas:usar` | `criarTarefa` (com responsáveis, prazo e subtarefas) |
| `propor_mudar_status_tarefa` | `tarefas:usar` | `mudarStatus` |
| `propor_adicionar_checklist` | `tarefas:usar` | `adicionarItemChecklist`. Substituiu "comentar tarefa", porque tarefas ainda não têm comentários |
| `propor_criar_evento` | `agenda:editar_institucional` | `criarEvento`. A agenda só cria eventos institucionais; **não há evento pessoal pelo Nexu** |
| `propor_criar_post` | `conteudo:usar` | `criarConteudo` (legenda como rascunho) |
| `propor_registrar_venda` | `comercial:registrar_venda` | `criarVenda`. Vendedor só no próprio nome. O cartão mostra o nome do cliente, porque a pessoa o digitou |

### Ferramentas por papel
| Papel | Recebe |
|---|---|
| admin e gestor | todas |
| colaborador | tudo, menos `relatorio_tarefas_equipe`, `vendas_e_metas`, `produtos` e `propor_registrar_venda` |
| comercial | as do colaborador, mais `vendas_e_metas`, `produtos` e `propor_registrar_venda` |
| professor e aluno | nenhuma (sem `nexu:usar`) |

A fonte da verdade é `src/lib/permissoes.ts`; a matriz acima acompanha a permissão de cada ferramenta.

## Telas
- **Botão flutuante** em todas as telas de `(app)` (quem tem `nexu:usar`): painel lateral com a conversa atual, "Nova conversa" e "Abrir no Nexu". Mostra "Consultando …" durante cada ferramenta. Envia a rota atual como contexto.
- **`/nexu` e `/nexu/[conversaId]`:** lista de conversas (com apagar) e conversa em tela cheia, com o contador de perguntas do dia.
- **Cartão de proposta:** resumo, **Confirmar** e **Recusar**; depois mostra o resultado com link, "Recusada" ou o erro.
- **`/admin/nexu`** (`nexu:configurar`): modelo, limite mensal e perguntas por dia; painel de uso (gasto do mês contra o limite, por pessoa e por dia). **Sem acesso ao conteúdo das conversas.** Salvar gera auditoria `nexu.configuracao_alterada`.

## Resposta aos poucos (SSE)
`POST /api/nexu/mensagens` devolve `text/event-stream`, um `data: <JSON>` por evento: `conversa`, `texto`, `consultando`, `proposta`, `fim` e `erro`. É a exceção à regra "Route Handlers só para o que vem de fora" (ADR 0006).

## Camada compartilhada `src/lib/ia/`
`cliente` (SDK, só no servidor), `precos` (tabela por modelo e cálculo do custo), `uso` (grava `UsoIa`), `limites` (regras puras do dia e do mês) e `configuracao` (lê `ConfiguracaoIa`). Não importa nada de `src/modulos/nexu`, para o agente do WhatsApp reaproveitar a chave, o custo e os limites.

## Integrações com outros módulos
O Nexu só **consome** serviços de Tarefas, Agenda, Acadêmico, Conteúdo e Comercial, sempre com o `UsuarioAtual` da pessoa. Nenhum módulo importa o `nexu`.

## Situação da implementação
**N1 (implementada no ramo `nexu-n1`, ainda sem deploy):** conversa, consultas, seis propostas com confirmação, histórico com limpeza de 90 dias, registro de uso e limites, tela do admin.

**Passos do Gustavo antes de testar em `teste`:** conta no console.anthropic.com com limite de gasto e `ANTHROPIC_API_KEY` no hPanel do app de teste (salvar reinicia o app; não precisa de build).

## Pendências conhecidas
- As ferramentas de consulta não devolvem `listaId`, `statusId`, `tipoId` nem `formatoId`. Quando o modelo erra o id numa proposta, o erro lista as opções válidas para ele corrigir.
- Proposta presa em `executando` (queda do servidor no meio da confirmação) não tem recuperação automática.
- No proxy da Hostinger, confirmar depois do deploy que a resposta chega aos poucos (SSE).
- Conferir o preço de cache do Haiku 5.5 na página oficial da Anthropic.

## Fora do escopo (N1)
Espião de concorrentes (N2, próxima spec), ações sem confirmação, editar ou excluir dados pelo Nexu, acesso de professores e alunos, anexos na conversa, voz, consultas ao Core (usuários e auditoria), eventos pessoais e o Nexu no WhatsApp.
