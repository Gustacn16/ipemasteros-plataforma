# 0008 — Download de páginas externas pelo servidor (Espião)

- **Status:** Aceito
- **Data:** 2026-11-18

## Contexto
O espião de concorrentes (Nexu N2a) lê landing pages cadastradas pelo admin, e o Nexu pode ler na hora qualquer URL que a pessoa pedir (`espiao_pagina_agora`). Um servidor que baixa URLs escolhidas por alguém pode ser usado para alcançar a rede interna da Hostinger ou endereços de metadados (SSRF). Uma página grande demais ou lenta pode travar a coleta.

## Decisão
- Todo download passa por `baixarPagina` (`src/modulos/espiao/fontes/pagina.ts`). Não existe outro `fetch` de URL externa no espião.
- Só `http:` e `https:`.
- O host é resolvido antes do pedido, e o download é recusado se **qualquer** endereço for interno, local ou reservado (IPv4 privado, `127/8`, `169.254/16`, `100.64/10`, `0/8`; IPv6 `::1`, `fc00::/7`, `fe80::/10`; IPv4 mapeado em IPv6).
- Redirecionamento manual (`redirect: "manual"`), até 3 saltos, e cada destino passa pela mesma checagem.
- Limites: 15 s e 2 MB por página. O `User-Agent` é genérico, sem dados da IPEMaster.
- Os erros viram mensagens em português, sem repassar o erro original.
- O texto baixado é **dado de terceiros**: entra no prompt do Claude entre `<dados_externos>`, com instrução para não obedecer nada dentro dele. O Nexu só executa algo depois do clique da pessoa (ADR 0007).
- O vídeo dos Reels só é baixado de domínios da própria Meta (`*.cdninstagram.com` e `*.fbcdn.net`), até 25 MB.

## Alternativas consideradas
- **Navegador sem tela (Playwright) para páginas montadas por JavaScript:** lê mais páginas, mas é pesado para o servidor da Hostinger e aumenta a superfície de ataque. Fica para depois, se fizer falta. Por enquanto essas páginas aparecem como "não legível".
- **Agente HTTP com checagem do IP na hora da conexão:** fecha a brecha de um DNS que responde um IP na checagem e outro na conexão (DNS rebinding). Exigiria a dependência `undici` direto. Fica registrado como risco residual baixo, porque as URLs da coleta são cadastradas só pelo admin.

## Consequências
- Páginas que dependem de JavaScript ficam "não legíveis" (sem sinal falso).
- Existe um risco residual de DNS rebinding na leitura sob demanda do Nexu; revisar se o Nexu ganhar acesso de mais papéis.
