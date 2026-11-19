# Runbook: motor do WhatsApp na VPS da Hostinger

Passo a passo para o motor do WhatsApp ficar ligado 24 horas numa VPS (servidor próprio), em vez do seu Mac. Faça um passo de cada vez, com o Claude guiando. **O segredo nunca é colado no chat**: só direto no arquivo `.env` dentro da VPS.

Os comandos dos passos 2 em diante rodam **dentro da VPS** (pela conexão SSH), como `root`.

## 1. Contratar a VPS (você faz)
1. Abra o hPanel da Hostinger → **VPS** → contratar.
2. Escolha o plano **KVM** mais simples e o sistema **Ubuntu 24.04 LTS**.
3. Anote o endereço IP da VPS e defina a senha do `root` no painel (a senha fica só com você).

## 2. Entrar por SSH
No terminal do seu Mac (troque `IP_DA_VPS` pelo endereço anotado):

```bash
ssh root@IP_DA_VPS
```

## 3. Instalar Node 22 e git
```bash
apt-get update && apt-get install -y curl git ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v
```
O último comando deve mostrar `v22...`.

## 4. Deixar o git baixar a biblioteca do WhatsApp
Uma dependência (`libsignal`) vem por um endereço `git+ssh`. Este comando faz o git usar https no lugar:

```bash
git config --global url."https://github.com/".insteadOf ssh://git@github.com/
```

## 5. Baixar o código com uma chave só de leitura
1. Crie a chave na VPS:
   ```bash
   ssh-keygen -t ed25519 -N "" -f /root/.ssh/deploy_ipemaster
   cat /root/.ssh/deploy_ipemaster.pub
   ```
2. Copie a linha que apareceu (é a chave **pública**, pode ser colada). No GitHub, abra o repositório → **Settings → Deploy keys → Add deploy key**, cole, dê o nome `vps-motor-whatsapp` e **não** marque "Allow write access".
3. De volta na VPS, clone (repositório `Gustacn16/ipemasteros-plataforma`):
   ```bash
   GIT_SSH_COMMAND="ssh -i /root/.ssh/deploy_ipemaster -o StrictHostKeyChecking=accept-new" git clone git@github.com:Gustacn16/ipemasteros-plataforma.git /opt/ipemaster-os
   cd /opt/ipemaster-os
   git config core.sshCommand "ssh -i /root/.ssh/deploy_ipemaster"
   git checkout teste
   ```

## 6. Instalar as dependências
```bash
cd /opt/ipemaster-os/motor-whatsapp
npm ci
```

## 7. Criar o `.env` (você cola o segredo)
```bash
cd /opt/ipemaster-os/motor-whatsapp
cp .env.exemplo .env
nano .env
```
Dentro do editor, preencha:
- `SISTEMA_URL=https://teste.plataformaipemaster.com.br`
- `MOTOR_WHATSAPP_SEGREDO=` com o mesmo segredo configurado no site (cole **aqui**, nunca no chat).

Salve com `Ctrl + O`, `Enter`, e saia com `Ctrl + X`. Depois proteja o arquivo:

```bash
chmod 600 /opt/ipemaster-os/motor-whatsapp/.env
```

## 8. Criar o usuário `motor`
Ele roda o motor e não consegue entrar no servidor.

```bash
useradd --system --create-home --home-dir /var/lib/motor --shell /usr/sbin/nologin motor
mkdir -p /opt/ipemaster-os/motor-whatsapp/sessoes
chown -R motor:motor /opt/ipemaster-os/motor-whatsapp/sessoes
chown motor:motor /opt/ipemaster-os/motor-whatsapp/.env
chmod 700 /opt/ipemaster-os/motor-whatsapp/sessoes
```

## 9. Instalar e ligar o serviço
**Antes deste passo, pare o motor do Mac (passo 12) e volte aqui.**

```bash
cp /opt/ipemaster-os/motor-whatsapp/deploy/motor-whatsapp.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now motor-whatsapp
systemctl status motor-whatsapp --no-pager
```
Deve aparecer `active (running)`.

## 10. Agendar a cópia diária das sessões (3h30)
As sessões são as chaves do aparelho: a cópia fica em `/var/backups/motor-whatsapp`, protegida, e guarda 7 dias.

```bash
chmod +x /opt/ipemaster-os/motor-whatsapp/deploy/copiar-sessoes.sh
crontab -l 2>/dev/null | grep -q copiar-sessoes || (crontab -l 2>/dev/null; echo '30 3 * * * /opt/ipemaster-os/motor-whatsapp/deploy/copiar-sessoes.sh >> /var/log/copiar-sessoes.log 2>&1') | crontab -
crontab -l
```
Para testar já:

```bash
/opt/ipemaster-os/motor-whatsapp/deploy/copiar-sessoes.sh
ls -l /var/backups/motor-whatsapp
```

## 11. Firewall: só SSH de entrada
O motor só faz chamadas de saída, então nada precisa estar aberto além do SSH.

```bash
ufw allow OpenSSH
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
ufw status
```

## 12. Parar o motor do Mac (faça antes do passo 9)
Dois motores com a mesma sessão fazem o WhatsApp derrubar um deles (erro 440). No terminal do Mac, onde o motor está rodando, aperte `Ctrl + C` e confirme que fechou. Não ligue mais o motor no Mac.

## 13. Levar a sessão do Mac (ou ler o QR de novo)
**Com o motor do Mac já parado**, dá para copiar a sessão do Mac para a VPS e o número conecta sem QR (foi assim na primeira instalação, em 18/11/2026). No Mac, dentro de `motor-whatsapp`:

```bash
tar -czf - -C sessoes --exclude=.motor.pid . | ssh root@IP_DA_VPS 'cd /opt/ipemaster-os/motor-whatsapp/sessoes && tar -xzf - && chown -R motor:motor . && systemctl restart motor-whatsapp'
```

Os avisos `Ignoring unknown extended header keyword` do tar são normais (atributos do macOS). Sem a sessão do Mac: no site, **Desconectar** e **Conectar** cada número de novo e ler o QR no celular (*Aparelhos conectados*).

## 14. Teste de aceite: reiniciar a VPS
```bash
reboot
```
Espere 2 minutos, entre de novo por SSH (passo 2) e olhe a tela do WhatsApp no site: cada número deve voltar a **Conectado** sozinho, **sem QR**. Se voltar, está pronto. Se não voltar, veja os logs (passo 16).

## 15. Atualizar o motor
Quando houver uma versão nova:

```bash
cd /opt/ipemaster-os
git pull
cd motor-whatsapp
npm ci
systemctl restart motor-whatsapp
```

## 16. Ver os logs
```bash
journalctl -u motor-whatsapp -n 100 --no-pager
```
Para acompanhar ao vivo (saia com `Ctrl + C`):

```bash
journalctl -u motor-whatsapp -f
```

## 17. Restaurar a cópia das sessões
Use se a pasta de sessões se perder ou estragar.

1. Veja as cópias e escolha a data:
   ```bash
   ls -l /var/backups/motor-whatsapp
   ```
2. Pare o motor, guarde a pasta atual, restaure (troque `AAAA-MM-DD` pela data escolhida) e ligue de novo:
   ```bash
   systemctl stop motor-whatsapp
   mv /opt/ipemaster-os/motor-whatsapp/sessoes /opt/ipemaster-os/motor-whatsapp/sessoes.velha
   tar -xzf /var/backups/motor-whatsapp/sessoes-AAAA-MM-DD.tar.gz -C /opt/ipemaster-os/motor-whatsapp
   chown -R motor:motor /opt/ipemaster-os/motor-whatsapp/sessoes
   chmod 700 /opt/ipemaster-os/motor-whatsapp/sessoes
   systemctl start motor-whatsapp
   ```
3. Confira na tela do WhatsApp. Se os números voltaram, apague a pasta `sessoes.velha`. Se uma sessão já tinha sido encerrada no celular, será preciso ler o QR de novo (passo 13).

## 18. Crons da IA e das métricas
O resumo diário dos grupos e as métricas do atendimento usam quatro linhas de cron, criados no hPanel (**Avançado → Cron Jobs**). O servidor está em UTC: `30 7 * * *` é 4h30 em São Paulo. Troque `<CRON_SECRET>` pelo valor guardado nas variáveis de ambiente do site.

```
30 7 * * * curl -fsS --max-time 600 -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/ia-whatsapp
0 8 * * * curl -fsS --max-time 600 -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/ia-whatsapp
*/15 * * * * curl -fsS --max-time 600 -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/coletar-ia-whatsapp
10 * * * * curl -fsS --max-time 600 -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/metricas-whatsapp
```

A primeira linha (7h30 UTC) envia o pedido do resumo do dia. A segunda (8h UTC) é uma execução de segurança, para o caso de a das 7h30 não rodar: é inofensiva, porque se o lote do dia já existe ela só responde `ja_existe`. A terceira recolhe as respostas a cada 15 minutos. A quarta recalcula as métricas do atendimento. O `--max-time 600` dá até 10 minutos para o envio, que pode demorar com muitos grupos. Sem a variável `ANTHROPIC_API_KEY`, nada é enviado (a tela **Saúde** mostra "IA não configurada").

A linha `metricas-whatsapp` roda a cada hora, no minuto 10, e recalcula as métricas de tempo de resposta e de follow-up do atendimento (hoje e os 4 dias anteriores; número sem histórico ainda recebe 35 dias). Ela alimenta só a aba Atendimento; a aba CS é calculada na hora e não depende do cron.

Marque o time de cada número na tela Números **antes** de criar o cron de métricas, para o histórico já sair com o time certo.
