# Módulo Espião (Nexu N2a)

## Objetivo
Um "sniper" dos concorrentes: toda semana, mostrar **o que mudou** e merece ação (conteúdo que estourou, preço ou página nova, salto de seguidores), com o link de origem. Junto vêm os indicadores de cada concorrente e uma análise curta da IA. Pelo Nexu, dá para perguntar sobre os dados guardados ou ler na hora qualquer perfil ou página.

Spec: `docs/superpowers/specs/2026-11-18-nexu-n2-espiao-design.md`. Plano: `docs/superpowers/plans/2026-11-18-nexu-n2a-espiao.md`. ADR do download de páginas: `docs/decisoes/0008-download-de-urls-externas.md`.

## Entidades
| Modelo | Para quê |
|---|---|
| `Concorrente` | nome, @ do Instagram, domínio, ativo, exclusão lógica (até 10 ativos) |
| `PaginaConcorrente` | landing page acompanhada (até 10 por concorrente), legível ou não, último hash |
| `VersaoPagina` | texto limpo e preços de cada versão diferente da página |
| `FotoInstagram` | seguidores, posts, bio e link do perfil a cada coleta |
| `MidiaConcorrente` | post/Reels com métricas, transcrição, resumo e situação da transcrição |
| `ColetaEspiao` | execução da coleta: origem, status, passos feitos (para retomar) e erros (só tipo) |
| `SinalEspiao` | o que mudou; `chave` única impede sinal repetido |
| `RelatorioEspiao` | análise da IA de uma coleta |
| `GastoEspiao` | custo de serviços externos (Groq; DataForSEO e Apify nas próximas entregas) |
| `ConfiguracaoIa.limiteEspiaoMicroUsd` | teto mensal do espião (padrão US$ 10) |
| `Usuario.espiaoVistoEm` | para o número de sinais novos no menu |

## Regras
- **Fontes:** Instagram pelo Business Discovery (API oficial, chave `META_ACCESS_TOKEN`, perguntando como a conta da IPEMaster ligada no Conteúdo C2a); páginas por `baixarPagina` (só http/https, sem rede interna, 2 MB, 15 s, 3 redirecionamentos); Reels transcritos pelo Groq (`GROQ_API_KEY`, vídeo só da CDN da Meta e até 25 MB).
- **Primeira coleta de um concorrente** é só linha de base: não gera sinal.
- **Sinais** (regras em `src/modulos/espiao/regras/sinais.ts`):
  - `conteudo_destaque`: mídia de até 14 dias com ≥ 3× a mediana das últimas 30 do mesmo tipo (≥ 5 mídias). Para Reels, conta visualizações; sem elas, curtidas + comentários. Uma vez por mídia.
  - `ritmo_mudou`: posts da semana ≥ 2× ou ≤ 0,5× a média semanal das 4 semanas anteriores (≥ 4 posts nesse período).
  - `seguidores_salto`: +3% ou −2% contra a foto com 5 dias ou mais.
  - `bio_link_mudou`: bio ou link do perfil mudou.
  - `pagina_nova`: página que ficou legível depois da primeira leitura.
  - `preco_mudou`: o conjunto de preços achados mudou (antes e depois no detalhe).
  - `pagina_mudou`: ≥ 5% das palavras mudaram. A IA escreve o título.
- **Limpeza antes de comparar:** sem menu, cabeçalho, rodapé e scripts; datas, horas e contadores ("faltam 3 dias", "12 vagas") viram marcadores.
- **A IA só descreve** (resumo do Reels, título da mudança, análise semanal). Texto de concorrente vai entre `<dados_externos>`.
- **Gasto:** antes de cada passo pago, confere o teto do espião (externos + Claude com origem `espiao`) e o limite geral da IA. Estourou → coleta `sem_saldo`.
- **Coleta:** cron diário `espiao` inicia se a última concluída tiver mais de 6 dias. Roda em segundo plano, por passos idempotentes; parada há mais de 2 h é retomada. Erro num concorrente → coleta `parcial`, os outros seguem.
- **Semana:** segunda a domingo em São Paulo.
- **Retenção:** 18 meses (a última versão de cada página sempre fica).
- **LGPD:** só dados públicos de empresas; nada de comentários, seguidores ou fotos de pessoas. Logs só com ids e tipos de erro.

## Telas
- `/espiao` (`espiao:ver`): sinais da semana, tabela de indicadores, análise da IA e semanas anteriores.
- `/espiao/[id]`: seguidores por coleta, sinais, posts com resumo e transcrição, páginas com histórico de preços.
- `/espiao/configurar` (`espiao:configurar`): chaves, teto e gasto do mês, concorrentes e páginas, coletas e "Coletar agora", "Testar perfil".

## Permissões
`espiao:ver` = admin, gestor e comercial. `espiao:configurar` = admin. Auditoria: `espiao.concorrente_criado|alterado|excluido`, `espiao.pagina_alterada`, `espiao.teto_alterado`, `espiao.coleta_manual`.

## Configuração
Runbook: `docs/runbooks/espiao.md`. Variáveis: `GROQ_API_KEY`; `ESPIAO_TRANSCRICAO=desligada` se o teste da Meta mostrar que o vídeo dos Reels não vem.

## Pendências
- **N2b:** SEO e anúncios do Google (DataForSEO). **N2c:** anúncios da Meta (Apify).
- Páginas feitas só em JavaScript ficam "não legíveis" (sem navegador de verdade por enquanto).
- O número no menu só atualiza numa carga completa da página.
- Duas coletas criadas no mesmo instante (cron + botão) não têm trava de banco; é raro.
- Risco residual de DNS rebinding na leitura de páginas (ADR 0008).
