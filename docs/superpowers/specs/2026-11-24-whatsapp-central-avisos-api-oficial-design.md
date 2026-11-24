# WhatsApp: central reorganizada, avisos nos grupos e API oficial

Data: 2026-11-24. Revisa o spec base (`2026-11-17-whatsapp-design.md`) e o das entregas 3–5 (`2026-11-18-whatsapp-ia-e-atendimento-design.md`). Onde divergirem, vale este documento. Substitui a "entrega 6 — disparo programado" do spec base.

## 1. Por que

O Gustavo acha a área do WhatsApp confusa: seis abas soltas (Grupos, Atendimento, Leads, CS, Conversas, Números) sem uma visão de conjunto. Ele quer:

1. **Ver tudo com clareza:** qual número é qual, onde estão os pontos de contato e as oportunidades.
2. **Avisos nos grupos (API não oficial, o motor atual):** o sistema lê a agenda da semana (ex.: "quinta tem aula do Dr. Leonardo Prestes"), escreve o aviso sozinho, o Gustavo só aprova e o motor envia nos grupos no horário.
3. **API oficial da Meta (número novo):** disparos para pessoas, uma a uma, com modelos aprovados pela Meta: aviso de formatura, vídeo de onboarding, follow-up, comunicado de fim de ano e automações básicas. Ele quer ver se o disparo foi entregue, configurar disparos e aprovar modelos.

Palavras dele: "essa área precisa ser robusta e mais estruturada".

## 2. Decisões do Gustavo

- Dois caminhos, cada um para um uso: **não oficial (motor Baileys) só para grupos**; **API oficial só para pessoas** (não manda em grupo).
- Nada de aviso automático sem aprovação dele: o sistema prepara, ele aprova.
- O número da API oficial é ligado no mesmo app da Meta que já usamos para o Meta Ads.
- Ele delegou as demais escolhas ("pode realizar todas as aprovações"). As escolhas feitas por Claude estão marcadas **[escolha de Claude]**.

## 3. Fatos que limitam o desenho

- A API oficial (Cloud API) não envia em grupos já existentes. Grupos continuam no motor.
- Um número registrado na Cloud API sai do aplicativo comum do WhatsApp (só o WhatsApp Business tem o modo "coexistência"). **[escolha de Claude]** O número oficial é um número **novo**, diferente dos 3 que o motor lê.
- Fora da janela de 24 h depois da última mensagem do cliente, a Meta só deixa enviar **modelos aprovados** (categorias: utilidade, marketing, autenticação). A Meta cobra por mensagem de modelo entregue; marketing custa bem mais que utilidade. O pagamento é feito no Gerenciador de Negócios, no cartão do Gustavo, fora do sistema.
- O motor hoje só sabe `conectar`/`desconectar`. Enviar em grupo é comando novo.
- Regras de segurança do motor (spec base §9) continuam valendo para os avisos: 8 a 20 s aleatórios entre grupos, no máximo 30 grupos por aviso, 60 envios por número por dia, só entre 8h e 20h.

## 4. Abordagens consideradas

| | Como | Prós | Contras |
|---|---|---|---|
| **A. Reorganizar a área em seções + duas áreas novas no mesmo módulo** (escolhida) | Um módulo WhatsApp com menu em dois níveis: Visão geral, Grupos, Equipe, API oficial, Configurações | Tudo do WhatsApp num lugar; reaproveita permissões e telas | Mexe na navegação de telas que já existem |
| B. Módulo separado "Disparos" | Avisos e API oficial num módulo novo do menu lateral | Não toca nas telas atuais | Mais um item no menu; o Gustavo quer justamente juntar e clarear |
| C. Ferramenta pronta (WATI, Blip, Z-API) para a API oficial | Contratar e só ligar | Rápido | Custo mensal fixo; dados fora do sistema; não conversa com agenda, vendas e alunos |

**[escolha de Claude]** A, pela razão do próprio Gustavo: uma área só, mais clara.

Referências usadas para a estrutura: WATI e Respond.io (separação Campanhas / Modelos / Contatos / Relatórios na API oficial; status enviado → entregue → lido → falhou por pessoa), Kommo (gatilhos simples tipo "quando entra na etapa X, envia Y") e Blip (aprovação de modelos e tela de qualidade do número).

## 5. Nova estrutura da área

Menu do módulo em dois níveis. Primeiro nível (seções) e, dentro, as abas:

```
WhatsApp
 ├ Visão geral                      (nova)
 ├ Grupos      → Grupos · Avisos      (Avisos é novo)
 ├ Equipe      → Atendimento · Leads · CS · Conversas
 ├ API oficial → Disparos · Modelos · Contatos · Automações   (tudo novo)
 └ Configurações → Números · Regras de atendimento · Uso de IA
```

Permissões: as de hoje continuam. Novas: `whatsapp:avisos` (criar e aprovar avisos de grupo) e `whatsapp:oficial` (tudo da API oficial). **[escolha de Claude]** As duas vão só para admin e gestor. Vendedor continua vendo só as próprias conversas e o próprio número.

### 5.1 Visão geral (nova)

Uma tela que responde "como está o WhatsApp hoje":

```
┌ Números ──────────────────────────────────────────────────┐
│ CS (Ana)      ● conectado   12 conversas hoje  2 sem resposta │
│ Comercial     ● conectado   30 conversas       5 sem resposta │
│ Paciente mod. ○ desconectado (há 2 dias)                      │
│ API oficial   ● ativo  qualidade: alta  limite: 1.000/dia     │
└───────────────────────────────────────────────────────────┘
┌ Oportunidades ───────────┐ ┌ Pontos de atenção ─────────────┐
│ 8 leads quentes          │ │ 3 alunos sem 1º contato da CS   │
│ 5 sem follow-up há 2 dias│ │ 2 avisos esperando aprovação    │
│ → abre Leads filtrado    │ │ 1 disparo com falhas            │
└──────────────────────────┘ └─────────────────────────────────┘
┌ Próximos envios ─────────────────────────────────────────┐
│ qui 08:00  Aviso "Aula Dr. Leonardo" → 4 grupos  (aprovado) │
│ sex 10:00  Disparo "Fim de ano" → 320 pessoas    (rascunho) │
└───────────────────────────────────────────────────────────┘
```

Tudo vem de dados que já existem (métricas da entrega 4, leads da 5, CS) mais os novos avisos e disparos. Cada número de cartão leva à tela filtrada.

## 6. Avisos nos grupos (motor não oficial)

### 6.1 Como funciona

1. **Toda segunda-feira às 7h** **[escolha de Claude]**, um cron lê a agenda institucional (`EventoInstitucional`) da semana seguinte (segunda a domingo) e cria um **rascunho de aviso** por evento, para os tipos de evento marcados como "divulgar nos grupos".
2. A IA escreve o texto do rascunho a partir do título, data, hora, local, turma e descrição do evento, num tom curto de aviso de escola. **[escolha de Claude]** Modelo `claude-haiku-5-5` (texto curto, barato), dentro do limite de IA do WhatsApp (US$ 80). Sem IA disponível, usa um texto padrão montado por modelo fixo.
3. O rascunho já vem com **grupos sugeridos**: os grupos monitorados ligados à turma do evento (`ConversaWhatsapp.turmaId`); se o evento não tem turma, os grupos marcados como padrão para aquele tipo de evento. E com **horário sugerido**: 1 dia antes do evento às 9h **[escolha de Claude]**.
4. O Gustavo abre **Grupos → Avisos**, vê os rascunhos da semana, edita texto, grupos e horário, e **aprova** (um por um ou "aprovar todos"). Só aviso aprovado é enviado.
5. No horário, o sistema cria um comando `enviar_grupo` por grupo na fila do motor, espaçados pelas regras do §3. O motor envia e devolve o resultado.
6. A tela mostra por grupo: aguardando, enviado, falhou (com motivo).

Também dá para criar **aviso avulso** (texto livre, sem evento), com o mesmo fluxo de aprovação e horário. Repetição semanal fica para depois.

### 6.2 Regras

- Só envia por um número conectado que **está no grupo** (`NumeroNoGrupo`). **[escolha de Claude]** Preferência: o número do time CS; se não estiver no grupo, qualquer número da escola que esteja. Sem número no grupo, o grupo aparece como "sem número para enviar" e não entra.
- Horário fora de 8h–20h é recusado na tela.
- Se o evento for apagado ou mudar de data depois da aprovação, o aviso volta para rascunho com um alerta.
- Cancelar é possível até o envio começar.
- v1 só texto. Imagem e vídeo nos grupos ficam para depois.
- Auditoria: criar, aprovar, editar, cancelar aviso.

### 6.3 Dados novos

- `AvisoGrupo`: id, eventoId?, texto, agendadoPara, situacao (`rascunho`/`aprovado`/`enviando`/`concluido`/`cancelado`/`falhou`), origem (`agenda`/`avulso`), aprovadoPorId?, aprovadoEm?, criadoPorId?, alertas.
- `EnvioAvisoGrupo`: id, avisoId, conversaId (grupo), numeroId, situacao (`aguardando`/`enviado`/`falhou`/`sem_numero`), enviadoEm?, erro?.
- `TipoEvento` ganha `divulgarNosGrupos` (bool) e uma lista de grupos padrão (tabela `GrupoPadraoTipoEvento`).
- `TipoComandoWhatsapp` ganha `enviar_grupo`; `dados` leva `{ jid, texto, envioId }`.
- Motor: novo tratamento do comando com `sock.sendMessage(jid, { text })` e retorno do id da mensagem ou do erro.

## 7. API oficial (Cloud API da Meta)

### 7.1 Conexão

- Número novo, adicionado à conta do WhatsApp Business (WABA) dentro do mesmo app da Meta do Meta Ads. O Gustavo faz o cadastro do número no Gerenciador da Meta; Claude guia passo a passo.
- Variáveis no hPanel (o Gustavo cola; nunca no chat): `WHATSAPP_OFICIAL_TOKEN` (token de usuário do sistema), `WHATSAPP_OFICIAL_NUMERO_ID`, `WHATSAPP_OFICIAL_WABA_ID`, `WHATSAPP_OFICIAL_APP_SECRET`, `WHATSAPP_OFICIAL_VERIFICACAO`.
- Webhook novo `/api/whatsapp-oficial/webhook`: GET para a verificação da Meta; POST com assinatura `X-Hub-Signature-256` conferida. Recebe status das mensagens (enviada, entregue, lida, falhou), respostas dos clientes e mudanças de status dos modelos.
- Tela de status em Visão geral e em Configurações: número, nome verificado, qualidade (alta/média/baixa) e limite de envios do dia, lidos da Graph API.

### 7.2 Modelos (aba Modelos)

- Criar modelo no sistema: nome, categoria (utilidade ou marketing), idioma pt_BR, cabeçalho opcional (texto, imagem ou **vídeo**), corpo com variáveis `{{1}}`, `{{2}}`, rodapé e botões (link ou resposta rápida).
- "Enviar para aprovação" manda à Meta. O status (em análise, aprovado, recusado com motivo, pausado) chega pelo webhook e por uma sincronização a cada hora.
- Prévia de como fica no celular.
- Exemplos que já nascem como sugestão (rascunho, não enviados): boas-vindas com vídeo de onboarding, aviso de formatura, follow-up de lead, comunicado de fim de ano.

### 7.3 Contatos (aba Contatos)

- Base de contatos vem do que o sistema já tem: alunos (Acadêmico), compradores (Vendas) e leads (conversas do WhatsApp). Também importação de planilha (nome, telefone).
- Cada contato tem **consentimento** (de onde veio, quando) e pode estar **descadastrado**. Quem responde "SAIR", "PARAR" ou toca no botão "Não quero receber" é descadastrado sozinho e nunca mais entra em disparo.
- Filtros salvos viram **públicos**: ex. "alunos da turma X", "compraram o produto Y", "leads quentes sem compra".

### 7.4 Disparos (aba Disparos)

1. Novo disparo: escolhe o modelo aprovado, o público, preenche as variáveis (fixas ou de campo: nome, turma, data) e o horário.
2. A tela mostra **quantas pessoas**, quantas foram tiradas (descadastrados, telefone inválido, repetidos) e o **custo estimado** pela categoria do modelo.
3. Disparo vai para **aprovação** (mesmo padrão dos avisos). Aprovado, entra na fila.
4. Um cron a cada minuto envia em lotes **[escolha de Claude: até 60 por minuto]**, respeitando o limite diário do número.
5. Relatório por disparo: enviadas, entregues, lidas, respondidas, falhas (com motivo), e a lista por pessoa. Botão "reenviar para quem falhou".

### 7.5 Automações (aba Automações)

Gatilhos simples, cada um ligado a um modelo aprovado e com liga/desliga:

| Gatilho | Exemplo |
|---|---|
| Venda registrada (Comercial) | após 10 min, envia "boas-vindas + vídeo de onboarding" |
| Data de um evento da turma | 3 dias antes da formatura, envia o aviso de formatura |
| Lead sem resposta há N dias | envia o follow-up |
| Data fixa | 20/12, comunicado de fim de ano para um público |

Cada execução gera um envio que aparece no relatório. **[escolha de Claude]** Automação nova nasce desligada; ligar exige aprovação (`whatsapp:oficial`). Toda automação respeita descadastro e limite diário.

### 7.6 Respostas

Respostas dos clientes ao número oficial ficam registradas e aparecem no relatório do disparo e num aviso "X pessoas responderam". **Responder pelo sistema (caixa de entrada) continua fora** desta etapa: quem responde usa o aplicativo do Gerenciador do WhatsApp da Meta.

### 7.7 Dados novos

`ModeloOficial`, `ContatoOficial` (telefone único, nome, origem, consentimentoEm, descadastradoEm), `PublicoOficial` (filtro salvo), `DisparoOficial` (modelo, público, variáveis, agendadoPara, situacao, aprovadoPorId, custoEstimado), `EnvioOficial` (disparo ou automação, contato, wamid, situacao, erro, enviadoEm, entregueEm, lidoEm), `AutomacaoOficial` (gatilho, configuração, modelo, ligada), `RespostaOficial` (contato, texto, recebidaEm).

## 8. LGPD e segurança

- Texto da política de privacidade ganha: envio de avisos em grupos e mensagens pela API oficial, com descadastro.
- Logs nunca registram texto de mensagem nem telefone.
- Token da Meta só em variável de ambiente; webhook só aceita assinatura válida.
- Auditoria: aprovar aviso, aprovar disparo, ligar automação, criar e enviar modelo, importar contatos.

## 9. Entregas

| # | Entrega | Pronto quando |
|---|---|---|
| 6 | **Central reorganizada** | Menu em seções, Visão geral com números, oportunidades e pontos de atenção; telas atuais nos novos lugares, links antigos redirecionam |
| 7 | **Avisos nos grupos** | Rascunhos da agenda da semana aparecem, o Gustavo aprova e o aviso chega aos grupos no horário, com status por grupo |
| 8 | **API oficial: conexão, modelos e disparos** | Número oficial conectado, um modelo aprovado pela Meta e um disparo de teste entregue com relatório |
| 9 | **API oficial: contatos e automações** | Públicos e descadastro funcionando; automação "venda → boas-vindas" envia sozinha |

## 10. Fora desta etapa

Caixa de entrada para responder clientes; chatbot; mídia nos avisos de grupo; disparo para pessoas pelo motor não oficial (proibido: risco de bloqueio); repetição automática de avisos avulsos.

## 11. Respostas às perguntas do revisor (todas escolhas de Claude)

1. **Relógio dos envios.** Um cron novo no hPanel, `envios-whatsapp`, a cada 5 min (`*/5 * * * *`); minuto a minuto não é garantido na hospedagem. Ele (a) cria os comandos dos avisos que chegaram na hora e (b) envia o próximo lote da API oficial (até 300 por execução, ≈ 60/min). A sincronização de modelos vai no mesmo cron, uma vez por hora. O Gustavo cria a linha do cron.
2. **Evento → grupos.** Sem campo novo na agenda: o rascunho compara o texto `EventoInstitucional.turma` com o nome das turmas **em memória** (sem acento, sem maiúscula, igualdade exata; nunca LIKE). Achou a turma, sugere os grupos monitorados dela; senão, os grupos padrão do tipo; senão, nenhum, e o rascunho mostra "escolha os grupos".
3. **Espaçamento e limites dos avisos.** Ficam no **site**, não no motor. `ComandoWhatsapp` ganha `executarApos`; o site distribui os comandos de um aviso com 8–20 s aleatórios entre eles, e a rota que entrega comandos ao motor só entrega os vencidos, um por número por vez. O limite de 60 envios por número por dia é contado no site somando todos os avisos; o que passar vira `falhou` com o motivo "limite do dia". O horário 8h–20h é conferido na aprovação, e o último envio previsto (horário + 30 grupos × 20 s) também precisa cair antes das 20h.
4. **Quem recebe pela API oficial.** Alunos e compradores viram `ContatoOficial` sozinhos (origem `aluno`/`venda`). Modelos de **utilidade** (onboarding, formatura, aviso) vão a qualquer contato não descadastrado: é comunicação do serviço contratado. Modelos de **marketing** (fim de ano promocional, follow-up de lead) só vão a contatos com `consentimentoMarketing` marcado: planilha importada com a coluna de consentimento declarada pelo Gustavo, ou quem tocou no botão "Quero receber novidades". Leads de conversa não contam como consentimento.
5. **Telefone.** Guardado normalizado com DDI 55 e o nono dígito, usando `chaveTelefone`/`variantesTelefone` já existentes para juntar Acadêmico, Vendas e leads.
6. **Custo.** Preço por mensagem em US$ por categoria, editável em Configurações (valores iniciais da tabela da Meta para o Brasil). Limite mensal da API oficial, padrão US$ 50, editável: um disparo cujo custo estimado passe do saldo do mês não pode ser aprovado.
7. **Evento muda com o aviso `enviando`.** Os comandos ainda não executados são cancelados, os já enviados ficam, e o aviso fica `concluido` com alerta "evento mudou durante o envio".
8. **Vídeo de onboarding.** Upload na tela do modelo (MP4 até 16 MB). O arquivo fica no banco (mesmo padrão das fotos, ADR 0004) e é servido por uma rota pública com nome aleatório, usada como `link` do cabeçalho no envio; para a aprovação, o sistema faz o upload de exemplo na Meta (upload retomável) e guarda o identificador.

## 12. Deixado para quem constrói

Layout exato das telas dentro do padrão visual do sistema; nomes de arquivos; versão da Graph API (usar a mais recente estável e fixar numa constante); preço por categoria como configuração editável.
