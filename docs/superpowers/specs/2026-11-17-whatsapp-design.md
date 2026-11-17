# WhatsApp — acompanhamento da operação: especificação

- **Status:** Proposto
- **Data:** 2026-11-17
- **Base:** `docs/02-arquitetura.md` (jobs por cron, Route Handlers só para o que vem de fora), `docs/04-seguranca-permissoes.md` (papéis, auditoria, LGPD), `docs/modulos/comercial.md` (vendas e vendedores), `docs/modulos/academico.md` (alunos e turmas). Onde divergir deles, vale este documento, e os docs afetados são atualizados na implementação.
- **Referência externa:** o sistema que um amigo do Gustavo montou ("Conexão WhatsApp Business"): Baileys + motor Node sempre ligado + fila de comandos no banco + tela que desenha o QR. Não reaproveitamos código dele; seguimos o mesmo desenho e as mesmas lições (seção 4).

## 1. Objetivo e porquê
A IPEMaster opera muito pelo WhatsApp (grupos de alunos e atendimento comercial), e hoje ninguém consegue acompanhar tudo. O Gustavo quer **revisar e acompanhar a operação completa** sem precisar abrir cada celular.

Quatro necessidades, na ordem de prioridade dele:
1. **Grupos de alunos:** um resumo do que está acontecendo, do que os alunos estão conversando e de quem está falando.
2. **Vendedores:** o que falam com os clientes, o tempo de resposta (SLA) e a qualidade do atendimento.
3. **Leads:** o que os leads estão respondendo, para o comercial.
4. **Disparo:** mensagens programadas para os grupos.

**Critério de sucesso:** de manhã, o Gustavo abre o IPEMaster OS e, em poucos minutos, sabe (a) o que aconteceu ontem em cada grupo de aluno, com as dúvidas e reclamações sem resposta; (b) quanto cada vendedor demorou para responder e quais conversas ficaram sem resposta; (c) em que pé está cada lead e qual o próximo passo; sem abrir nenhum celular.

## 2. Objetivos, não objetivos e anti-objetivos
**Entra:** conectar números da empresa por QR; capturar mensagens de texto de grupos e conversas individuais desses números; resumo diário dos grupos por IA; SLA calculado por regra; situação do lead e nota de qualidade por IA; disparo programado para grupos; tudo dentro do IPEMaster OS, com permissões e auditoria.

**Fica de fora (por enquanto):** responder clientes pelo sistema (caixa de entrada); transcrever áudios e ler imagens/documentos (guardamos só o tipo: "[áudio]", "[imagem]"); disparo em massa para contatos individuais; chatbot que responde sozinho; API oficial da Meta; integração com o Kommo (F6, futura).

**Anti-objetivos (seria fracasso mesmo funcionando):**
- Um número da escola ou de vendedor **bloqueado** pelo WhatsApp por causa do sistema.
- Conversas pessoais de alguém lidas sem querer, ou dados de alunos e clientes vazando (LGPD).
- O celular do vendedor parar de receber notificações ou mostrar "visto" que ele não deu.
- Um painel tão cheio que ninguém abre: o resumo tem que caber numa leitura de café.

## 3. Restrições
- Não existe forma oficial de ler grupos já existentes nem as conversas do aplicativo do vendedor: a API oficial da Meta não faz isso. Por isso a conexão é **por QR (Baileys)**, que é **não oficial** e vai contra os termos do WhatsApp. O Gustavo aceitou esse risco; as regras da seção 9 existem para reduzi-lo.
- A conexão por QR exige um programa **ligado 24 horas**. A hospedagem atual (Hostinger Cloud, app Next.js) não roda processos permanentes. Precisamos de um servidor à parte.
- Chaves e segredos o Gustavo cola no painel (hPanel / painel da VPS), nunca no chat.
- Stack e convenções do projeto (`CLAUDE.md`): Prisma por migration, permissões no servidor, auditoria em ação sensível, nada de dado pessoal em log ou URL, ADR para decisão de arquitetura nova.

## 4. Abordagens consideradas
| Abordagem | Como é | Prós | Contras | Escolha |
|---|---|---|---|---|
| **A. Motor próprio com Baileys numa VPS + módulo no IPEMaster OS** | Programa Node pequeno (`motor-whatsapp/`) numa VPS, conversando com o IPEMaster OS por HTTPS | Lê grupos e conversas; controle total; custo baixo (~R$ 30–60/mês da VPS); mesmo desenho do amigo, já provado | Não oficial (risco de bloqueio); precisamos manter o motor | **Escolhida** |
| B. Evolution API (pronta, open source) na VPS | Servidor pronto que já embrulha a Baileys, com API REST e webhooks | Menos código no motor | Mais uma peça grande para manter, atualizar e proteger; mesmo risco de bloqueio; menos controle sobre as regras anti-bloqueio | Descartada |
| C. API oficial da Meta (Cloud API) | Número oficial, mensagens via Meta | Sem risco de bloqueio; oficial | Não lê os grupos existentes nem o histórico do aplicativo do vendedor; pago por conversa | Descartada para a leitura. Fica como caminho para disparo em massa no futuro, como o amigo fez |

Lições do sistema do amigo que adotamos: sessão salva para não pedir QR a cada reinício; fila de comandos que o motor consulta a cada poucos segundos; vigia que religa o motor; ≥ 5 s entre grupos num disparo; nada de disparo em massa um a um; corrigir o bug de pareamento da Baileys 7 rc (usar uma versão estável que já tenha a correção, ou aplicar o patch).

## 5. Arquitetura
```
Celular (lê o QR)                     VPS Hostinger (sempre ligada)              Hostinger Cloud
                                      ┌──────────────────────────┐               ┌──────────────────────────┐
WhatsApp ◄── protocolo Web ──────────►│ motor-whatsapp (Node+    │── HTTPS ─────►│ IPEMaster OS (Next.js)   │
                                      │ Baileys), 1 conexão por  │  /api/whatsapp│ /api/whatsapp/motor/*    │
                                      │ número; sessão em disco  │◄── comandos ──│ MySQL (dados)            │
                                      └──────────────────────────┘               │ cron → IA (Claude Batch) │
                                                                                 └──────────────────────────┘
```
- **Motor (`motor-whatsapp/`, pasta própria no mesmo repositório, com `package.json` próprio):** Node 22 + TypeScript + Baileys. Mantém uma conexão por número. Envia eventos ao IPEMaster OS e busca comandos. Roda na VPS com reinício automático (pm2 ou systemd; escolha do builder) e um vigia que religa a conexão se ela cair.
- **Comunicação motor ↔ sistema:** só HTTPS, rotas `/api/whatsapp/motor/*` protegidas por `Authorization: Bearer $MOTOR_WHATSAPP_SEGREDO`. O MySQL **não** é aberto para fora. Toda validação (Zod) e regra fica no IPEMaster OS.
  - `POST /api/whatsapp/motor/eventos`: lote de eventos (estado da conexão, QR novo, conversas, contatos, mensagens). O motor junta os eventos e envia a cada ~3 s ou a cada 100 eventos. Idempotente por `idExterno`.
  - `GET /api/whatsapp/motor/comandos`: comandos pendentes; o motor marca o resultado com `POST /api/whatsapp/motor/comandos/<id>`. Consulta a cada 3 s.
- **Sessão da Baileys (chaves do aparelho conectado):** fica no disco da VPS, numa pasta por número, com cópia diária. Se perder, basta ler o QR de novo. *(Decisão do builder documentada: o amigo guardava no banco; aqui a sessão muda chaves com frequência e mandar isso por HTTP seria pesado.)*
- **IA:** cron no IPEMaster OS monta os pedidos e usa a **Message Batches API** da Anthropic (metade do preço, sem pressa). Seção 8.
- **Decisão de arquitetura nova:** vira `docs/decisoes/0006-motor-whatsapp-por-qr.md` na entrega 1.

## 6. Modelo de dados (Prisma)
Convenções do projeto: ids `cuid`, `criadoEm`/`atualizadoEm`, tabelas `snake_case` no plural, datas em UTC, exibição em `America/Sao_Paulo`.

| Modelo | Campos principais | Observações |
|---|---|---|
| `NumeroWhatsapp` | id, nome (≤60, ex.: "Comercial — Bruno"), finalidade (`escola`/`vendedor`), usuarioId? (dono, quando vendedor), telefone? (só dígitos, preenchido na conexão), situacao (`desconectado`/`aguardando_qr`/`conectado`/`erro`), qrAtual (Text)?, qrEm?, conectadoEm?, ultimoSinalEm?, erro?, excluidoEm? | A "vaga" de cada número. O QR vale ~20 s e é apagado ao conectar |
| `ComandoWhatsapp` | id, numeroId, tipo (`conectar`/`desconectar`/`sincronizar`/`enviar`), dados (Json), situacao (`pendente`/`em_andamento`/`concluido`/`falhou`), executarApos?, tentativas, erro?, concluidoEm? | Fila lida pelo motor |
| `ContatoWhatsapp` | id, telefone? (único, só dígitos), lid? (único, id oculto que o WhatsApp usa em grupos), nomeExibido? (nome do perfil), alunoId?, usuarioId? | Quem é quem. Liga automaticamente a `Aluno.telefone` ou ao WhatsApp do perfil do usuário quando os dígitos batem. Em grupos o WhatsApp muitas vezes só entrega o `lid`; aí aparece o nome do perfil, sem ligação com aluno, até o telefone ser conhecido *(decisão do builder: aceitável na v1)* |
| `ConversaWhatsapp` | id, jid, numeroId? (individual), tipo (`grupo`/`individual`), nome?, contatoId? (individual), turmaId? (grupo), numeroEnvioId? (grupo: por qual número disparar), categoria (`aluno`/`lead`/`equipe`/`pessoal`/`outro`), monitorada (bool), historicoAte? (grupo), ultimaMensagemEm? | **Grupo é único por `jid`**, mesmo que vários números da empresa estejam nele (sem mensagem nem resumo duplicado). Individual é único por (numeroId, jid). Grupos começam **não monitorados** (o admin escolhe). Individuais começam monitoradas, exceto `equipe` e `pessoal` |
| `NumeroNoGrupo` | numeroId, conversaId | Quais números da empresa estão em cada grupo |
| `MensagemWhatsapp` | id, conversaId, idExterno (único por conversa: em grupo, o id é o mesmo para todos os números), numeroId (quem capturou primeiro), contatoId? (autor), deMim (bool: enviada por algum número da empresa), tipo (`texto`/`imagem`/`audio`/`video`/`documento`/`figurinha`/`outro`), texto (Text)?, respondeAIdExterno?, enviadaEm | Só texto e legenda; mídia não é baixada. Apagada após 90 dias (seção 10) |
| `ResumoGrupo` | id, conversaId, dia (Date), resumo (Text), temas (Json), pendencias (Json), destaques (Json), participacao (Json: autor → nº de mensagens, calculado sem IA), totalMensagens, modelo, situacao (`pendente`/`pronto`/`falhou`), erro? | Único por (conversaId, dia) |
| `AvaliacaoConversa` | id, conversaId, dia, situacaoLead? (`novo`/`interessado`/`duvida`/`objecao_preco`/`negociando`/`sem_retorno`/`fechou`/`perdido`), oQueRespondeu (Text), proximoPasso (Text)?, notaQualidade (0–10)?, criterios (Json), pontosFortes (Text)?, melhorar (Text)?, modelo, situacao, erro? | Único por (conversaId, dia). Conversas individuais `lead` e `aluno` de qualquer número; nas de `aluno`, `situacaoLead` fica vazio e vale a nota de qualidade |
| `MetricaAtendimentoDia` | id, numeroId, dia, conversasComCliente, primeiraRespostaMedianaMin?, respostaMedianaMin?, dentroDoSlaPct?, semResposta | Calculada por regra pura, sem IA |
| `DisparoProgramado` | id, numeroId, texto (Text), agendadoPara, repeticao (`nenhuma`/`diaria`/`semanal`), situacao (`agendado`/`enviando`/`concluido`/`cancelado`/`falhou`), criadoPorId, canceladoEm? | Só para grupos |
| `EnvioDisparo` | id, disparoId, conversaId (grupo), situacao, enviadoEm?, erro? | Um por grupo |
| `LoteIa` | id, idExterno (batch da Anthropic), tipo (`resumo_grupo`/`avaliacao`), dia, situacao, criadoEm, concluidoEm? | Para o cron saber o que buscar |
| `ConfiguracaoWhatsapp` | linha única: horário comercial (Json, padrão seg–sex 8h–18h e sáb 8h–12h), slaMinutos (padrão 15), diasRetencao (padrão 90) | Editável pelo admin |

## 7. Regras de negócio
1. **Conectar:** admin/gestor cria a vaga e clica em Conectar → comando `conectar` → motor pede o QR à Baileys → grava em `qrAtual` → a tela mostra o QR e atualiza a cada 2 s → o celular lê em *Aparelhos conectados* → `conectado` com o telefone. O vendedor pode conectar a vaga **dele**.
2. **Desconectar:** comando `desconectar` faz logout e apaga a sessão no disco. Mensagens já salvas continuam até a retenção.
3. **Saúde:** o motor manda um sinal a cada minuto (`ultimoSinalEm`). Sem sinal há 5 min, a vaga aparece "motor sem resposta"; com `erro` ou deslogado pelo celular, "precisa ler o QR de novo". Isso aparece também em `/admin/saude`.
4. **Histórico:** ao conectar, o WhatsApp entrega o histórico uma única vez. O sistema guarda o dos últimos 30 dias de **todos** os grupos numa área provisória por **48 horas**; grupos marcados como monitorados nesse prazo ficam com esse histórico, e o resto é apagado. Grupo marcado depois disso começa do momento da marcação. *(Decisão do builder: equilíbrio entre não perder o histórico e não guardar o que não é acompanhado.)*
5. **Grupos monitorados:** a tela Grupos lista todos os grupos dos números conectados (sem repetir o grupo que está em vários números); o admin marca quais acompanhar e, se quiser, liga o grupo a uma `Turma`. Fora o histórico provisório da regra 4, mensagens de grupo não monitorado **não são salvas**.
5a. **Quem é "a equipe" num grupo:** mensagens de qualquer número da empresa (`deMim`) e de contatos ligados a um `Usuario` (professores, coordenação). Elas aparecem para a IA marcadas com "(equipe)", e é por elas que a IA decide se uma dúvida foi respondida.
6. **Categoria da conversa individual** (em qualquer número, inclusive o da escola, que também é acompanhado — decisão do Gustavo): `aluno` se o contato está ligado a um Aluno; `equipe` se é um usuário do sistema; senão `lead`. `outro` só por escolha manual. O vendedor e o gestor podem mudar. Marcar `pessoal` apaga as mensagens dela e para de salvar.
7. **SLA (regra pura, testada):** para cada mensagem do cliente que abre uma "vez" (primeira mensagem dele depois de uma resposta do vendedor), o tempo até a próxima mensagem do vendedor, contando **só o horário comercial**. "Primeira resposta" é a da primeira mensagem da conversa no dia. "Sem resposta" = cliente esperando há mais que o SLA dentro do horário. Entram as conversas individuais `lead` e `aluno` de todos os números, e cada número tem a sua linha no painel Equipe (o da escola aparece como "Escola"). Calculada de hora em hora para o dia corrente e fechada às 3h para ontem.
8. **Quem vê o quê:** gestor/admin veem todos os números; o vendedor (`comercial`) vê só as conversas, SLA e avaliações do próprio número. Abrir as mensagens completas da conversa de **outro** vendedor gera auditoria.
9. **Disparo:** só para grupos monitorados. No horário, o sistema cria um comando `enviar` por grupo, espaçados (seção 9). Cancelar antes do horário é possível. Criar, editar e cancelar geram auditoria.
10. **Leads × vendas:** quando um `Venda.whatsappCliente` bate com o telefone do contato, a avaliação mostra a venda e a situação vira `fechou`.

## 8. IA (resumos e avaliações)
- **Modelo:** `claude-opus-5-5` (o padrão atual), via SDK oficial `@anthropic-ai/sdk`, com **saída estruturada** (`output_config.format` com JSON Schema) para gravar direto nas colunas. Chave `ANTHROPIC_API_KEY` colada pelo Gustavo no hPanel.
- **Em lote:** cron `ia-whatsapp` às 4h30 cria um batch com (a) um pedido por grupo monitorado que teve mensagens ontem e (b) um pedido por conversa individual `lead` ou `aluno` com mensagens ontem. Cron `coletar-ia-whatsapp` a cada 15 min busca resultados de lotes abertos e grava. Os lotes ficam prontos, em geral, bem antes das 8h.
- **Entrada do resumo de grupo:** as mensagens do dia em ordem, como `[hh:mm] Nome: texto` (ou `[hh:mm] Nome (equipe): texto`, regra 5a), com o nome do contato (nunca o telefone). Pede: resumo em até 5 frases, temas, dúvidas/reclamações **sem resposta** da equipe, destaques. A participação (quem falou quanto) é contada pelo sistema, não pela IA.
- **Entrada da avaliação de lead:** as mensagens da conversa nos últimos 14 dias, com o dia de ontem marcado. Pede: situação do lead, o que ele respondeu, próximo passo sugerido e nota de qualidade de 0 a 10 com critérios fixos (cordialidade, clareza, respondeu as dúvidas, conduziu para o próximo passo, rapidez percebida), cada um com nota e uma frase.
- **Recusa ou erro:** se `stop_reason` for `refusal` ou o resultado falhar, a linha fica `falhou` com o motivo e a tela mostra "sem resumo neste dia"; o restante segue.
- **Custo estimado** (preço de lote, metade do normal: US$ 2 / US$ 10 por milhão de tokens): um grupo movimentado (~300 mensagens/dia) sai por ~US$ 0,05/dia; uma conversa de lead, ~US$ 0,01. Com 20 grupos e 100 leads/dia: **~US$ 2/dia (~US$ 60/mês)**. Se ficar caro, trocar para um modelo menor é uma linha de configuração; a decisão é do Gustavo.
- O prompt vive em código (`src/modulos/whatsapp/ia/`), versionado, com testes de montagem da entrada (sem chamar a API).

## 9. Regras contra bloqueio
- Motor entra com `markOnlineOnConnect: false` e **não envia confirmação de leitura**: o celular continua recebendo notificações e ninguém vê "visto" falso.
- Nenhum envio para contato individual na v1. Disparo só para grupos.
- Entre um grupo e outro: espera aleatória de 8 a 20 s; no máximo 30 grupos por disparo e 60 envios por número por dia.
- Variação opcional do texto (saudação do dia, ordem de emojis) ligada por padrão.
- Disparos só entre 8h e 20h.
- Reconexão com espera crescente (não ficar reconectando sem parar).
- Baileys numa versão estável com a correção do pareamento, travada no `package-lock`.

## 10. LGPD
- **Só números da empresa** são conectados. Nunca um número pessoal.
- **Base legal:** legítimo interesse (qualidade do atendimento e acompanhamento acadêmico). Ações na entrega 2: aviso na descrição dos grupos monitorados ("Este grupo é acompanhado pela equipe IPEMaster, com apoio de ferramentas automáticas"); termo de ciência para os vendedores; atualização da política de privacidade.
- **Mínimo de dados:** só texto; mídia não é baixada; números de telefone não vão para a IA.
- **Retenção:** mensagens apagadas após `diasRetencao` (90) por cron diário `limpar-whatsapp`. Resumos e avaliações ficam 1 ano e depois são apagados pelo mesmo cron.
- **Envio para a Anthropic:** as mensagens vão para a API da Anthropic para gerar resumos; a API não usa esses dados para treinar modelos. Registrar isso na política de privacidade como operador.
- **Direitos do titular:** `SolicitacaoTitular` ganha a opção de apagar tudo de um telefone (contato, mensagens, avaliações).
- **Logs:** nunca registrar texto de mensagem, telefone ou QR em log. Auditoria: conectar/desconectar número, marcar grupo monitorado, abrir conversa de outro vendedor, criar/cancelar disparo, mudar configuração.

## 11. Telas (menu "WhatsApp")
```
WhatsApp   [Grupos] [Equipe] [Leads] [Disparos] [Números]

Grupos — ontem ▾                                   ┌ Pós Psiquiatria T3 ───────────────┐
┌──────────────────────────────────────────────┐  │ 128 mensagens · 23 pessoas        │
│ Pós Psiquiatria T3   128 msgs   2 pendências │─►│ Resumo: ...                       │
│ TCT Turma 5           41 msgs   0 pendências │  │ Sem resposta: "quando sai o      │
│ ...                                          │  │   certificado?" — Ana, 14h02      │
└──────────────────────────────────────────────┘  │ Quem mais falou: Ana 18, João 12…│
                                                   └───────────────────────────────────┘
Equipe — hoje ▾
Vendedor     Conversas  1ª resposta  Dentro do SLA  Sem resposta  Qualidade
Bruno           34        6 min          88%            2           8,1
Leandro         21       22 min          61%            5           7,4
```
- **Grupos:** lista do dia escolhido, ordenada por pendências; detalhe com resumo, temas, pendências, destaques e participação. Link para ver as mensagens.
- **Equipe:** tabela por vendedor (hoje / ontem / 7 dias / mês), lista de conversas sem resposta agora.
- **Leads:** conversas `lead` com situação, o que respondeu, próximo passo e nota; filtro por vendedor e situação.
- **Disparos:** agendar (texto, grupos, data/hora, repetição), lista e cancelar.
- **Números:** vagas, situação, botão Conectar com o QR, Desconectar, último sinal.

**Permissões novas** (`src/lib/permissoes.ts`): `whatsapp:ver_grupos` (admin, gestor), `whatsapp:ver_equipe` (admin, gestor), `whatsapp:ver_proprio` (comercial), `whatsapp:gerenciar_numeros` (admin, gestor), `whatsapp:conectar_proprio` (comercial), `whatsapp:disparar` (admin, gestor), `whatsapp:configurar` (admin).

## 12. Entregas
Cada entrega tem um plano próprio (`docs/superpowers/plans/`), vai para `teste`, é validada pelo Gustavo e só então segue.

| # | Entrega | Pronto quando |
|---|---|---|
| 1 | **Motor e conexão**: tabelas `NumeroWhatsapp`/`ComandoWhatsapp`, rotas do motor, tela Números com QR, motor rodando no Mac do Gustavo apontando para `teste`, ADR 0006 | O Gustavo lê o QR com um número de teste e a tela mostra "conectado" |
| 2 | **Captura e servidor**: contatos, conversas, mensagens, histórico de 30 dias, escolher grupos monitorados, ligar grupo a turma, categorias; VPS com reinício automático e runbook; saúde em `/admin/saude`; cron de retenção; textos de LGPD | Mensagens dos grupos escolhidos aparecem no sistema com o motor na VPS, e reiniciar a VPS não pede QR de novo |
| 3 | **Resumo dos grupos (IA)** | De manhã, cada grupo monitorado tem o resumo de ontem |
| 4 | **SLA da equipe** (sem IA) | Painel Equipe mostra tempos e conversas sem resposta, batendo com uma conferência manual de 3 conversas |
| 5 | **Leads e qualidade (IA)** | Tela Leads mostra situação, resposta, próximo passo e nota de cada conversa de ontem |
| 6 | **Disparo programado** | Uma mensagem agendada chega aos grupos escolhidos no horário, com o espaçamento |

## 13. O que fica para o builder
- pm2 ou systemd na VPS; formato exato dos lotes de eventos; nomes de componentes; textos de erro; detalhes do JSON Schema da IA; índices do banco.
- Escolha da versão estável da Baileys que já corrige o pareamento (ou aplicar o patch como o amigo fez).

## 14. Depende do Gustavo (antes da entrega indicada)
- **Entrega 1:** quais números conectar primeiro (nome de cada vaga e quem é o dono).
- **Entrega 2:** contratar a VPS na Hostinger (plano mais simples basta) e colar `MOTOR_WHATSAPP_SEGREDO` no hPanel e na VPS.
- **Entrega 3:** criar a chave da Anthropic e colar `ANTHROPIC_API_KEY` no hPanel; criar os crons no hPanel.
- **Entrega 4:** confirmar horário comercial e meta de SLA (padrão: 15 min).
