# Runbook: ligar o espião de concorrentes

Faça um passo de cada vez, com o Claude acompanhando. **Nenhuma chave é colada no chat**: só no painel da Hostinger.

## 1. Testar o Instagram dos concorrentes
1. Entre na plataforma como admin e abra **Espião → Configurar**.
2. Em **Testar perfil**, digite o @ de cada concorrente (os 5) e clique em **Testar perfil**.
3. Anote a linha "Vídeo disponível em X de Y Reels".
   - Se aparecer "Perfil não encontrado ou não é uma conta profissional", aquele perfil é pessoal ou privado e o espião não consegue ler o Instagram dele (as páginas continuam valendo).
   - Se aparecer erro de permissão da chave, pare e chame o Claude.
4. **Somando os 5:** se o vídeo veio em pelo menos metade dos Reels, a transcrição fica ligada. Se não, ela fica desligada (passo 3).

## 2. Chave do Groq (transcrição dos Reels)
1. Crie uma conta em https://console.groq.com e gere uma chave em **API Keys**.
2. No hPanel → **Sites → (site do teste) → Node.js → Variáveis de ambiente**, adicione `GROQ_API_KEY` com a chave e salve (o app reinicia).

## 3. Se a transcrição não passou no teste
No mesmo lugar do passo 2, adicione `ESPIAO_TRANSCRICAO` = `desligada`. O espião passa a resumir os Reels só pela legenda.

## 4. Agendar a coleta
No hPanel → **Avançado → Tarefas Cron**, crie uma tarefa diária:
- Horário: `0 7 * * *` (o servidor está em UTC; isso dá ≈ 4h em Brasília).
- Comando: `curl -s -H "Authorization: Bearer SEU_CRON_SECRET" https://<domínio>/api/cron/espiao`, trocando `SEU_CRON_SECRET` pelo mesmo segredo das outras tarefas cron e `<domínio>` pelo endereço do site.

A tarefa roda todo dia, mas só coleta uma vez por semana (ou retoma uma coleta que parou).

## 5. Cadastrar e coletar
1. Em **Espião → Configurar → Novo concorrente**, cadastre os 5 concorrentes (nome, @ e domínio).
2. Em cada um, adicione as páginas de venda que quer acompanhar (até 10).
3. Clique em **Coletar agora**. A coleta roda em segundo plano: espere alguns minutos e atualize a página.
4. A primeira coleta é só a linha de base, então os sinais aparecem a partir da segunda (na semana seguinte, ou num novo "Coletar agora" depois).
5. Confira o **Gasto do mês** na mesma tela. O teto começa em US$ 10.
