# WhatsApp — IA e acompanhamento dos atendimentos (entregas 3 a 5)

Revisa as entregas 3 a 5 do spec base, `docs/superpowers/specs/2026-11-17-whatsapp-design.md`. Onde os dois divergirem, vale este documento. Disparo programado continua sendo a entrega 6, sem mudança.

## 1. Por quê
O Gustavo vai conectar três números, cada um usado por **uma pessoa só**:

- **CS (pós-venda):** fala com quem acabou de comprar e com os alunos. Ele quer saber quanto tempo a CS leva, depois que uma venda sai, para mandar a primeira mensagem ao comprador.
- **Atendimento de paciente modelo:** recebe os leads das campanhas da Meta para WhatsApp. Ele quer ver como está o atendimento:
  - se o atendente qualificou o lead;
  - se quebrou as objeções;
  - se fez follow-up;
  - quanto tempo levou para responder;
  - qual lead está mais quente.
- **Comercial:** a mesma coisa para os leads de cursos.

Ele também quer acompanhar a **evolução** de cada número semana a semana e receber, de manhã, o resumo de ontem de cada grupo monitorado.

## 2. Objetivos, fora de escopo e o que seria um fracasso
**Objetivos**
- Resumo diário de cada grupo monitorado.
- Tempos de resposta medidos pelo relógio, sem IA, para dar números exatos.
- Tempo da venda até o primeiro contato da CS.
- Avaliação diária de cada conversa com nota por critério, temperatura do lead e próximo passo.
- Evolução semanal por número.

**Fora de escopo nesta fase**
- Responder ou enviar mensagens pelo sistema.
- Avaliar áudio ou imagem (só texto, como na captura).
- Ranking entre pessoas.
- Alertas em tempo real.

**Seria um fracasso se**
- Os tempos não baterem com uma conferência manual.
- A IA inventar algo que não está na conversa.
- O telefone de alguém aparecer para a IA ou em log.
- O custo passar do combinado sem ninguém ver.

## 3. Decisões do Gustavo
- **Momento da venda:** é lançada no sistema logo que fecha. O tempo da CS conta a partir de `Venda.criadoEm`.
- **Tempo da CS:** em **horas corridas** desde a venda, sem descontar noite nem fim de semana.
- **Um número por pessoa:** a evolução de um número é a evolução daquela pessoa.
- **Critérios das vendas** (paciente modelo e comercial): qualificação, quebra de objeção, follow-up e tempo de resposta. Também a temperatura do lead, quente, morno ou frio.
- **Frequência da IA:** **uma vez por dia, de madrugada**, em lote. Às 8h estão prontas as avaliações e os resumos de ontem. Os tempos sem IA são atualizados de hora em hora.

## 4. Abordagens consideradas
| Abordagem | Como | Troca | Decisão |
|---|---|---|---|
| A. Lote diário de madrugada | Um lote da API às 4h30, com tudo o que teve mensagem ontem | Mais barato (preço de lote, ~US$ 2/dia). O lead quente só aparece no dia seguinte | **Escolhida pelo Gustavo** |
| B. Lote 3 vezes por dia (11h, 15h, 19h) | Só conversas com mensagem nova desde a última avaliação | Lead quente no mesmo dia. Custa 1,5 a 2 vezes mais | Descartada |
| C. Avaliar a cada mensagem | Chamada direta por mensagem nova | Tempo real, mas caro e barulhento | Descartada |

## 5. Os números ganham um "time"
`NumeroWhatsapp` ganha o campo `time` (`cs`, `paciente_modelo`, `comercial`, `outro`; padrão `outro`), editável na tela Números pela gestão. O time define três coisas:

| Time | Métricas sem IA | Avaliação da IA |
|---|---|---|
| `cs` | Tempo da venda até o primeiro contato; tempos de resposta | Atendimento: cordialidade, clareza, resolveu a dúvida, conduziu o próximo passo |
| `paciente_modelo`, `comercial` | Tempos de resposta; sem resposta; follow-up | Vendas: qualificação, quebra de objeção, follow-up, clareza e cordialidade, conduziu para o fechamento; temperatura do lead |
| `outro` | Tempos de resposta | Nenhuma |

A `finalidade` (`escola`/`vendedor`) continua como está: ela diz quem é o dono, e o `time` diz o que medir.

## 6. Entrega 3 — Resumo dos grupos
Segue a seção 8 do spec base:
- O cron `ia-whatsapp` roda às 4h30 e cria **um único lote** com os pedidos do dia: resumos de grupo (entrega 3) e, a partir da entrega 5, avaliações.
- O cron `coletar-ia-whatsapp` roda a cada 15 min e grava os resultados.
- Saída estruturada com JSON Schema. Recusa ou erro deixa a linha como `falhou`, e a tela mostra "sem resumo neste dia".
- Tela **Grupos**: dia escolhido (padrão ontem), resumo, temas, pendências sem resposta da equipe (com autor e hora), destaques e participação. A participação é contada pelo sistema, não pela IA.
- Usa a camada comum `src/lib/ia/` do Nexu: cliente, preço, `registrarUsoIa` com `origem: "whatsapp"` e `calcularCustoMicroUsd`. O lote custa 50% do preço normal, e o cálculo de custo precisa aplicar esse desconto quando a origem for lote.

## 7. Entrega 4 — Tempos de resposta e tempo da CS (sem IA)
Regras puras com testes, recalculadas de hora em hora para hoje e fechadas às 3h para ontem.

1. **Vez do cliente:** começa na primeira mensagem do cliente depois de uma mensagem da empresa, ou na primeira da conversa. Termina na próxima mensagem do número da empresa.
   - O tempo de resposta conta **só o horário comercial** (padrão seg–sex 8h–18h, sáb 8h–12h; editável).
   - Por dia e por número: **primeira resposta mediana** (da primeira vez do cliente no dia), **resposta mediana** e **% dentro do SLA** (padrão 15 min).
2. **Sem resposta:** conversa em que o cliente está esperando há mais que o SLA, contando o horário comercial. Aparece numa lista com o tempo de espera.
3. **Follow-up** (proposta do builder, editável): o cliente ficou sem responder por mais de **24 h** depois de uma mensagem da empresa.
   - Se a empresa mandou outra mensagem em até **3 dias**, conta como follow-up feito; se não, como perdido.
   - A métrica do número é a taxa de follow-up feito.
4. **Tempo da CS:** para cada `Venda` não excluída com `whatsappCliente`:
   - o contato é achado pela chave do telefone (`variantesTelefone`, sem LIKE);
   - o tempo vai de `Venda.criadoEm` até a primeira mensagem `deMim` de um número do time `cs` na conversa individual com esse contato;
   - conta em horas corridas.
   - **Sem contato ainda:** a venda aparece "aguardando primeiro contato", com o tempo correndo.
   - **Venda sem WhatsApp:** aparece como "sem WhatsApp na venda".
   - **CS escreveu antes da venda:** se a CS já conversava com a pessoa, vale a primeira mensagem **depois** da venda.
5. **Métricas por dia** (`MetricaAtendimentoDia`, do spec base): conversas com cliente, primeira resposta mediana, resposta mediana, % no SLA, sem resposta, follow-ups devidos e feitos, e, na CS, as vendas do dia, a mediana até o primeiro contato e quantas ainda aguardam.

## 8. Entrega 5 — Avaliação das conversas (IA)
- **O que entra:** uma avaliação por conversa individual, por dia, para cada conversa que teve mensagem ontem.
  - Só entram números com time `cs`, `paciente_modelo` ou `comercial`.
  - Só entram as categorias `lead` e `aluno`.
  - A entrada são as mensagens dos últimos 14 dias, com ontem marcado, como `[dd/mm hh:mm] Cliente:` / `Atendente:` (sem nome nem telefone).
  - A IA também recebe os tempos já calculados pela entrega 4, só para comentar. A nota de tempo é calculada pelo sistema, e a IA não mede tempo.
- **Saída para vendas:**
  - situação: `novo`, `qualificando`, `interessado`, `objecao`, `negociando`, `sem_retorno`, `fechou` ou `perdido`;
  - **temperatura**: `quente`, `morno` ou `frio`, com o motivo em uma frase;
  - o que o lead respondeu;
  - próximo passo sugerido;
  - critérios com nota de 0 a 10 e uma frase cada: qualificação, quebra de objeção, follow-up, clareza e cordialidade, conduziu para o fechamento;
  - nota geral, que é a média dos critérios calculada pelo sistema;
  - pontos fortes e o que melhorar.
- **Saída para a CS:** os critérios de atendimento da seção 5 e as mesmas partes de texto. Sem temperatura.
- **Critério que não se aplica:** fica `null` (por exemplo, quebra de objeção numa conversa sem objeção). Não entra na média e aparece como "não se aplica". Assim a IA não inventa.
- **Venda casada:** quando há uma `Venda` com o mesmo telefone, a situação vira `fechou` e a tela mostra a venda. Isso segue a regra 10 do spec base.

## 9. Telas (menu WhatsApp)
Abas: **Grupos · Atendimento · Leads · CS · Conversas · Números**, cada uma conforme as permissões que já existem. O vendedor vê só o próprio número.

```
Atendimento — semana ▾                       Paciente modelo (Ana)
┌──────────────────────────────────────────┐  1ª resposta  4 min  ▼ 2
│ Número      1ª resp  resp  SLA  sem resp │  Resposta     9 min  ▲ 1
│ Paciente m.  4 min  9 min  91%     2     │  No SLA       91%
│ Comercial   12 min 20 min  70%     5     │  Follow-up    60%
│ CS           3 min  7 min  95%     0     │  Nota IA      7,8  ▲ 0,4
└──────────────────────────────────────────┘  [gráfico 8 semanas]

Leads — ontem ▾  filtro: quente | morno | frio | número
🔥 Maria (Paciente modelo)  interessado  "pediu horário de sábado"  → enviar agenda
...

CS — vendas
Venda             Cliente  Saiu      1º contato   Tempo
Pós Psiq. T3      João     ontem 21h  hoje 9h10   12h10
TCT               Bia      hoje 10h   aguardando  3h20 ⏳
```

- **Atendimento:** tabela por número no período, com a evolução semanal: gráfico de 8 semanas com tempos, % no SLA, taxa de follow-up e nota média. Clicar abre a lista de conversas sem resposta e as piores notas.
- **Leads:** conversas de vendas avaliadas, com filtro por temperatura, situação e número. O padrão é ontem, quentes primeiro.
- **CS:** vendas do período com o tempo até o primeiro contato. As que aguardam ficam no topo.

## 10. Custo e limite
- **Estimativa:** com lote diário, ~US$ 2/dia (~US$ 60/mês), como no spec base. A conta é de 20 grupos e ~100 conversas por dia.
- **Limite próprio:** o WhatsApp tem um limite mensal próprio em `ConfiguracaoWhatsapp`, de US$ 80 (seção 13). Ao chegar perto, as avaliações daquele dia são puladas e a tela avisa. Os resumos de grupo vêm primeiro.

## 11. LGPD
Valem as regras do spec base e da entrega 2b:
- Para a IA vão só texto e papéis ("Cliente", "Atendente", nome do contato nos grupos), nunca telefone.
- Resumos e avaliações ficam 1 ano e são apagados pelo `limpar-whatsapp`.
- Apagar os dados de um telefone também apaga as avaliações das conversas dele.
- A política de privacidade já cita a Anthropic como operadora (docs/lgpd/whatsapp-textos.md).

## 12. Fica com o builder
- Formato exato dos JSON Schemas e do texto dos prompts (em `src/modulos/whatsapp/ia/`, com testes de montagem da entrada).
- Índices e nomes de componentes.
- Como agrupar os pedidos no lote.
- Cores e ícones da temperatura.
- O gráfico, usando a biblioteca que o projeto já usa no Comercial.

## 12a. Decisões do builder (conferidas na revisão)
- **Vendas que entram no tempo da CS:** só as criadas depois que o primeiro número `cs` conectou (`conectadoEm`). Venda aguardando há mais de 7 dias vira "sem contato" e para de contar no tempo médio.
- **Critérios pelo time do número:** os critérios da avaliação vêm do `time` do número, não da categoria da conversa. Um comprador novo na CS pode estar como `lead` e é avaliado com os critérios de CS.
- **Categorias fora das métricas:** tempos e métricas ignoram as conversas `equipe`, `pessoal` e `outro`, como a avaliação.
- **Histórico estável:** cada linha diária de métrica e de avaliação guarda o `time` do número naquele dia. Mudar o time depois não reescreve o histórico.
- **Nota da semana:** média da avaliação mais recente de cada conversa na semana (uma por conversa), para não contar o mesmo lead várias vezes.
- **Fora da conta:** feriados não entram. A vez do cliente que cruza a meia-noite conta no dia em que começou.
- **Situação do lead:** o enum novo substitui o do spec base, por migration.

## 13. Respostas do Gustavo à revisão
- **Respostas automáticas:** os números não mandam mensagem automática. Toda mensagem `deMim` conta como resposta da pessoa.
- **Quem vê:**
  - As abas **Atendimento**, **Leads** e **CS** são só da gestão: admin e gestor, com `whatsapp:ver_equipe`. A gestão vê também as mensagens completas.
  - Os atendentes não veem as próprias métricas nem as notas nesta fase.
  - O vendedor `comercial` continua vendo só as conversas do próprio número, como hoje.
- **Limite de gasto:** o orçamento total de API é US$ 100 por mês. Cada origem tem o seu limite: Nexu US$ 20 (como hoje) e WhatsApp **US$ 80**.
  - A soma do Nexu passa a contar só a origem `nexu`, e a do WhatsApp só a origem `whatsapp`.
  - Os dois limites ficam editáveis pelo admin.
