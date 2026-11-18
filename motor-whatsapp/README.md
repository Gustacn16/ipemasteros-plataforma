# Motor do WhatsApp

Programa pequeno que fica sempre ligado, conecta os números de WhatsApp da empresa pelo QR (biblioteca Baileys) e conversa com o IPEMaster OS pela internet (HTTPS). Ele não acessa o banco.

O que ele faz:
- A cada 3 segundos pergunta ao sistema se há pedidos de "Conectar" ou "Desconectar" e executa um por vez.
- Manda para o sistema o QR para a tela, o aviso de "conectado" e o de "desconectado".
- A cada 60 segundos avisa que está vivo e quais números estão conectados.
- Guarda a sessão de cada número na pasta `sessoes/`. Ao ligar de novo, reconecta sozinho, sem pedir QR.

## Como rodar no Mac (apontando para o site de teste)

Precisa do Node 20.12 ou mais novo (`node -v`).

1. Entre na pasta do motor:
   ```bash
   cd motor-whatsapp
   ```
2. Crie o arquivo de configuração:
   ```bash
   cp .env.exemplo .env
   ```
3. Abra o `.env` e preencha:
   - `SISTEMA_URL=https://teste.plataformaipemaster.com.br`
   - `MOTOR_WHATSAPP_SEGREDO=` com o mesmo segredo configurado no site de teste.
4. Instale (só na primeira vez):
   ```bash
   npm install
   ```
5. Ligue o motor:
   ```bash
   npm start
   ```
6. No site, abra a tela do WhatsApp e clique em **Conectar**. O QR aparece na tela; leia com o celular em *Aparelhos conectados*.

Para desligar, aperte `Ctrl + C`. Ele envia o que estiver pendente e sai.

Se faltar `SISTEMA_URL` ou o segredo, o motor para na hora e diz o que falta.

## Cuidados
- O `.env` e a pasta `sessoes/` nunca vão para o Git (já estão no `.gitignore`). Quem tem a pasta `sessoes/` tem acesso ao WhatsApp conectado.
- Só um motor pode usar a pasta de sessões: ao ligar, ele cria o arquivo `.motor.pid` nela; se outro motor estiver rodando, o novo para na hora avisando o pid.
- `PASTA_SESSOES` (opcional) muda a pasta das sessões; o padrão é `sessoes/` dentro do motor, qualquer que seja a pasta de onde você roda o comando.
- `NIVEL_LOG_BAILEYS` (opcional) aceita `silent` (padrão), `warn` ou `info`. Use `warn` só para investigar, porque a Baileys pode imprimir JIDs (telefones).
- Para trocar de número ou começar do zero, use **Desconectar** na tela (isso apaga a sessão).

## Testes
```bash
npm test
npx tsc --noEmit
```
