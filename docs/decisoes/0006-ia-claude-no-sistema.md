# 0006 — Claude dentro do sistema (Nexu)

- **Status:** Aceito
- **Data:** 2026-11-17

## Contexto
O Nexu é um assistente que responde perguntas sobre os dados do sistema e propõe ações. Isso exige escolher o fornecedor de IA, como a IA acessa os dados sem vazar o que a pessoa não pode ver, como a resposta chega aos poucos na tela e onde fica o código que um futuro agente do WhatsApp também vai usar.

## Decisão
- **Fornecedor e SDK:** Claude, pelo `@anthropic-ai/sdk` (TypeScript), Messages API com streaming. A chave `ANTHROPIC_API_KEY` fica só em variável de servidor (`import "server-only"`) e nunca aparece em tela, log, banco ou erro.
- **Modelo padrão:** `claude-haiku-5-5`, pelo menor custo, trocável pelo admin na configuração (`claude-sonnet-5-5` e `claude-opus-5-5`). A chamada usa `max_tokens` 4000, `output_config: { effort: "low" }`, sem `temperature`/`top_p` e `tool_choice` automático.
- **Acesso a dados por ferramentas sobre os serviços:** o modelo nunca escreve SQL. Cada ferramenta chama o serviço do módulo com o `UsuarioAtual` da pessoa, então as checagens de permissão e as regras de visibilidade que já existem valem também para a IA. O servidor monta a lista de ferramentas a partir das permissões do papel. As ferramentas devolvem só campos escolhidos (nunca e-mail, telefone, CRM ou observações de aluno) e listas de até 50 itens com o total.
- **Ações só por proposta:** a ferramenta de ação grava uma `PropostaNexu` pendente. A execução acontece numa Server Action disparada pelo clique em Confirmar, como a pessoa que confirmou, com nova checagem de permissão e auditoria. É a defesa contra instruções escondidas nos dados (prompt injection).
- **SSE em Route Handler (exceção):** `POST /api/nexu/mensagens` devolve `text/event-stream`. Server Actions não servem bem para streaming. Isto é uma **exceção** à regra "Route Handlers só para o que vem de fora".
- **Camada comum `src/lib/ia/`:** `cliente`, `precos`, `uso`, `limites` e `configuracao`, sem importar nada de `src/modulos/nexu`. O limite mensal soma todas as origens de `UsoIa`, então o agente do WhatsApp dividirá o mesmo orçamento.
- **Limites:** US$ 20 por mês, 50 perguntas por pessoa por dia, 8 chamadas de ferramenta por pergunta, 30 perguntas por conversa e 60 s por pergunta. Os dois primeiros são editáveis pelo admin.
- **Privacidade:** cada pessoa vê só as próprias conversas (nem o admin lê as dos outros). Conversas, mensagens e propostas são apagadas fisicamente após 90 dias, pelo cron diário. `UsoIa` não guarda texto e fica para o histórico de custo.

## Alternativas consideradas
- **Modelo escrevendo SQL:** flexível, mas pula as regras de permissão e arrisca vazar dado pessoal (LGPD). Descartado.
- **Ações sem confirmação:** mais rápido, mas qualquer texto malicioso nos dados poderia disparar uma ação. Descartado.
- **WebSocket ou polling em vez de SSE:** exigem infraestrutura que a hospedagem não oferece ou ficam piores na experiência. SSE em um Route Handler é o mais simples.
- **Tool Runner do SDK:** o loop próprio dá controle de custo, de limites e de gravação de cada passo.
- **Código de IA dentro do módulo `nexu`:** o WhatsApp precisaria importar o Nexu. A camada comum evita isso.
- **Sonnet como padrão:** melhor em perguntas que cruzam módulos, mas bem mais caro. Fica como opção na configuração.

## Consequências
- O Gustavo precisa de uma conta na Anthropic com limite de gasto e da `ANTHROPIC_API_KEY` no hPanel.
- Há um custo variável por pergunta (estimativa de cerca de US$ 0,002 com o Haiku), sob dois limites no sistema e um no console da Anthropic.
- A qualidade do Haiku em perguntas que cruzam módulos pode ser insuficiente; trocar o modelo não exige deploy.
- Resposta bufferizada pelo proxy da Hostinger apareceria inteira no fim; confirmar o streaming depois do deploy.
- O preço de cache do Haiku 5.5 em `src/lib/ia/precos.ts` precisa ser conferido na página oficial.
- Proposta presa em `executando` após queda do servidor não se recupera sozinha.
